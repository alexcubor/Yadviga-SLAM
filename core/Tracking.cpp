#include <emscripten.h>
#include <emscripten/threading.h>
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <mutex>

// Global variables for tracking
extern volatile bool slamActive;
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> trackingPoints;  // Buffer for tracking points
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> prevTrackingPoints;  // Buffer for previous points
EMSCRIPTEN_KEEPALIVE int trackingPointsCount = 0;  // Number of tracking points
EMSCRIPTEN_KEEPALIVE bool pointsReady = false;  // Flag for points readiness
EMSCRIPTEN_KEEPALIVE std::vector<uchar> pointStatus;  // Status of each point (1 if tracked, 0 if lost)
EMSCRIPTEN_KEEPALIVE uint8_t* pointDescriptors = nullptr;  // Descriptors for each point
EMSCRIPTEN_KEEPALIVE size_t descriptorSize = 32;  // Fixed size for ORB descriptors
EMSCRIPTEN_KEEPALIVE cv::Mat essentialMatrix;  // Essential Matrix

// Camera motion data from recoverPose
EMSCRIPTEN_KEEPALIVE cv::Mat cameraRotation;  // Rotation matrix 3x3
EMSCRIPTEN_KEEPALIVE cv::Mat cameraTranslation;  // Translation vector 3x1
EMSCRIPTEN_KEEPALIVE bool motionReady = false;  // Flag for motion data readiness
EMSCRIPTEN_KEEPALIVE int goodPointsCount = 0;  // Number of good points used for pose estimation

// Raw data storage for debugging
EMSCRIPTEN_KEEPALIVE cv::Mat rawEssentialMatrix;  // Raw Essential Matrix from findEssentialMat
EMSCRIPTEN_KEEPALIVE cv::Mat rawRotationMatrix;   // Raw Rotation Matrix from recoverPose
EMSCRIPTEN_KEEPALIVE cv::Mat rawTranslationVector; // Raw Translation Vector from recoverPose
EMSCRIPTEN_KEEPALIVE std::vector<uchar> rawInlierMask;  // Raw inlier mask from findEssentialMat
EMSCRIPTEN_KEEPALIVE std::vector<uchar> rawRecoverPoseStatus;  // Raw status from recoverPose
EMSCRIPTEN_KEEPALIVE bool rawDataReady = false;  // Flag for raw data readiness

// Optical flow data storage
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> opticalFlowPrevPoints;  // Previous points from optical flow
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> opticalFlowCurrPoints;  // Current points from optical flow
EMSCRIPTEN_KEEPALIVE std::vector<uchar> opticalFlowStatus;  // Status from optical flow
EMSCRIPTEN_KEEPALIVE std::vector<float> opticalFlowError;  // Error from optical flow
EMSCRIPTEN_KEEPALIVE bool opticalFlowReady = false;  // Flag for optical flow data readiness

// Mutexes for thread safety
EMSCRIPTEN_KEEPALIVE std::mutex trackingMutex;  // Mutex for tracking points
EMSCRIPTEN_KEEPALIVE std::mutex pointsReadyMutex;  // Mutex for points readiness
EMSCRIPTEN_KEEPALIVE std::mutex motionMutex;  // Mutex for motion data

// Declare external variables
extern bool frameReady;
extern std::mutex frameMutex;
extern uint8_t* frameBuffer;
extern int frameWidth;
extern int frameHeight;
extern cv::Mat cameraMatrix;
extern double trackingInterval;
extern std::mutex fpsMutex;

// Functions for accessing tracking points
extern "C" float* getTrackingPoints() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    float* points = (float*)malloc(trackingPoints.size() * 3 * sizeof(float));
    for (size_t i = 0; i < trackingPoints.size(); i++) {
        points[i * 3] = (trackingPoints[i].x / frameWidth) * 2 - 1;  // x
        points[i * 3 + 1] = (trackingPoints[i].y / frameHeight) * 2 - 1;  // y
        points[i * 3 + 2] = (i < pointStatus.size()) ? pointStatus[i] : 0; // status
    }
    return points;
}

extern "C" int getTrackingPointsCount() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    return trackingPointsCount;
}

extern "C" bool arePointsReady() {
    std::lock_guard<std::mutex> lock(pointsReadyMutex);
    return pointsReady;
}

// Functions for accessing camera motion data
extern "C" float* getCameraMotion() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    // Return array: [rx, ry, rz, tx, ty, tz]
    // rx, ry, rz - rotation in radians (Euler angles)
    // tx, ty, tz - translation in camera units
    float* motion = (float*)malloc(6 * sizeof(float));
    
    if (motionReady && !cameraRotation.empty() && !cameraTranslation.empty()) {
        // Convert rotation matrix to Euler angles
        cv::Mat R = cameraRotation;
        float sy = sqrt(R.at<double>(0,0) * R.at<double>(0,0) + R.at<double>(1,0) * R.at<double>(1,0));
        bool singular = sy < 1e-6;
        
        float x, y, z;
        if (!singular) {
            x = atan2(R.at<double>(2,1), R.at<double>(2,2));
            y = atan2(-R.at<double>(2,0), sy);
            z = atan2(R.at<double>(1,0), R.at<double>(0,0));
        } else {
            x = atan2(-R.at<double>(1,2), R.at<double>(1,1));
            y = atan2(-R.at<double>(2,0), sy);
            z = 0;
        }
        
        motion[0] = x;  // rx (roll)
        motion[1] = y;  // ry (pitch)
        motion[2] = z;  // rz (yaw)
        motion[3] = cameraTranslation.at<double>(0);  // tx
        motion[4] = cameraTranslation.at<double>(1);  // ty
        motion[5] = cameraTranslation.at<double>(2);  // tz
    } else {
        // Return zeros if no motion data available
        for (int i = 0; i < 6; i++) {
            motion[i] = 0.0f;
        }
    }
    
    return motion;
}

extern "C" bool isMotionReady() {
    std::lock_guard<std::mutex> lock(motionMutex);
    return motionReady;
}

extern "C" int getGoodPointsCount() {
    std::lock_guard<std::mutex> lock(motionMutex);
    return goodPointsCount;
}

// Functions for accessing raw data from findEssentialMat and recoverPose
extern "C" float* getRawEssentialMatrix() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    if (!rawDataReady || rawEssentialMatrix.empty()) {
        return nullptr;
    }
    
    // Essential Matrix is 3x3, so we need 9 float values
    float* matrix = (float*)malloc(9 * sizeof(float));
    
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            matrix[i * 3 + j] = (float)rawEssentialMatrix.at<double>(i, j);
        }
    }
    
    return matrix;
}

extern "C" float* getRawRotationMatrix() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    if (!rawDataReady || rawRotationMatrix.empty()) {
        return nullptr;
    }
    
    // Rotation Matrix is 3x3, so we need 9 float values
    float* matrix = (float*)malloc(9 * sizeof(float));
    
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            matrix[i * 3 + j] = (float)rawRotationMatrix.at<double>(i, j);
        }
    }
    
    return matrix;
}

extern "C" float* getRawTranslationVector() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    if (!rawDataReady || rawTranslationVector.empty()) {
        return nullptr;
    }
    
    // Translation Vector is 3x1, so we need 3 float values
    float* vector = (float*)malloc(3 * sizeof(float));
    
    for (int i = 0; i < 3; i++) {
        vector[i] = (float)rawTranslationVector.at<double>(i);
    }
    
    return vector;
}

extern "C" uint8_t* getRawInlierMask() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    if (!rawDataReady || rawInlierMask.empty()) {
        return nullptr;
    }
    
    // Copy inlier mask data
    uint8_t* mask = (uint8_t*)malloc(rawInlierMask.size() * sizeof(uint8_t));
    memcpy(mask, rawInlierMask.data(), rawInlierMask.size() * sizeof(uint8_t));
    
    return mask;
}

extern "C" int getInlierMaskSize() {
    std::lock_guard<std::mutex> lock(motionMutex);
    return rawInlierMask.size();
}

extern "C" uint8_t* getRawRecoverPoseStatus() {
    std::lock_guard<std::mutex> lock(motionMutex);
    
    if (!rawDataReady || rawRecoverPoseStatus.empty()) {
        return nullptr;
    }
    
    // Copy recoverPose status data
    uint8_t* status = (uint8_t*)malloc(rawRecoverPoseStatus.size() * sizeof(uint8_t));
    memcpy(status, rawRecoverPoseStatus.data(), rawRecoverPoseStatus.size() * sizeof(uint8_t));
    
    return status;
}

extern "C" int getRecoverPoseStatusSize() {
    std::lock_guard<std::mutex> lock(motionMutex);
    return rawRecoverPoseStatus.size();
}

extern "C" bool isRawDataReady() {
    std::lock_guard<std::mutex> lock(motionMutex);
    return rawDataReady;
}

// Functions for accessing optical flow data
extern "C" float* getOpticalFlowPrevPoints() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    
    if (!opticalFlowReady || opticalFlowPrevPoints.empty()) {
        return nullptr;
    }
    
    // Copy previous points data (x, y coordinates)
    float* points = (float*)malloc(opticalFlowPrevPoints.size() * 2 * sizeof(float));
    
    for (size_t i = 0; i < opticalFlowPrevPoints.size(); i++) {
        points[i * 2] = opticalFlowPrevPoints[i].x;
        points[i * 2 + 1] = opticalFlowPrevPoints[i].y;
    }
    
    return points;
}

extern "C" float* getOpticalFlowCurrPoints() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    
    if (!opticalFlowReady || opticalFlowCurrPoints.empty()) {
        return nullptr;
    }
    
    // Copy current points data (x, y coordinates)
    float* points = (float*)malloc(opticalFlowCurrPoints.size() * 2 * sizeof(float));
    
    for (size_t i = 0; i < opticalFlowCurrPoints.size(); i++) {
        points[i * 2] = opticalFlowCurrPoints[i].x;
        points[i * 2 + 1] = opticalFlowCurrPoints[i].y;
    }
    
    return points;
}

extern "C" uint8_t* getOpticalFlowStatus() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    
    if (!opticalFlowReady || opticalFlowStatus.empty()) {
        return nullptr;
    }
    
    // Copy status data
    uint8_t* status = (uint8_t*)malloc(opticalFlowStatus.size() * sizeof(uint8_t));
    memcpy(status, opticalFlowStatus.data(), opticalFlowStatus.size() * sizeof(uint8_t));
    
    return status;
}

extern "C" float* getOpticalFlowError() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    
    if (!opticalFlowReady || opticalFlowError.empty()) {
        return nullptr;
    }
    
    // Copy error data
    float* error = (float*)malloc(opticalFlowError.size() * sizeof(float));
    memcpy(error, opticalFlowError.data(), opticalFlowError.size() * sizeof(float));
    
    return error;
}

extern "C" int getOpticalFlowPointsCount() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    return opticalFlowPrevPoints.size();
}

extern "C" bool isOpticalFlowReady() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    return opticalFlowReady;
}

void trackingLoop() {
    EM_ASM({
        self.trackingFrameCount = 0;
    });
    
    // Static variables for tracking
    static bool isInitialized = false;
    static cv::Mat prevGray;

    // Initialize ORB detector
    cv::Ptr<cv::ORB> orb = cv::ORB::create(1000, 1.2f, 8, 31, 0, 2, cv::ORB::HARRIS_SCORE, 31, 20);
    
    while (true) {
        // Проверка активности SLAM
        if (!slamActive) {
            emscripten_sleep(100);
            continue;
        }
        
        bool isReady;
        {
            std::lock_guard<std::mutex> lock(frameMutex);
            isReady = frameReady;
        }
        
        if (isReady) {
            cv::Mat frame(frameHeight, frameWidth, CV_8UC4, frameBuffer);

            // Convert current frame to grayscale
            cv::Mat gray;
            cv::cvtColor(frame, gray, cv::COLOR_RGBA2GRAY);
                
            if (!isInitialized || trackingPoints.empty()) {
                EM_ASM({
                    console.log("✨ Tracking: Initializing engine");
                });
                    
                // Initialize at first frame
                std::vector<cv::Point2f> corners;
                cv::goodFeaturesToTrack(gray, corners, 25, 0.01, 10);
                prevGray = gray.clone();
                
                // Initialize both vectors in pixel coordinates
                {
                    std::lock_guard<std::mutex> lock(trackingMutex);
                    trackingPoints.clear();
                    prevTrackingPoints.clear();
                    pointStatus.clear();

                    for (const auto& corner : corners) {
                        trackingPoints.push_back(corner);  // Save in pixels
                        prevTrackingPoints.push_back(corner);  // Save in pixels
                        pointStatus.push_back(1); // Новая точка — стабильная
                    }
                    trackingPointsCount = trackingPoints.size();
                }
                
                isInitialized = true;
                
                // Compute descriptors for points
                std::vector<cv::KeyPoint> keypoints;
                for (const auto& pt : corners) {
                    keypoints.push_back(cv::KeyPoint(pt, 31));  // 31 is patch size
                }
                cv::Mat descriptors;
                orb->compute(gray, keypoints, descriptors);

                // Copy descriptors to pointDescriptors
                if (pointDescriptors) {
                    free(pointDescriptors);
                }
                pointDescriptors = (uint8_t*)malloc(keypoints.size() * 32);  // 32 bytes per descriptor
                memcpy(pointDescriptors, descriptors.data, keypoints.size() * 32);
                
                // Set the readiness flag
                {
                    std::lock_guard<std::mutex> lock(pointsReadyMutex);
                    pointsReady = true;
                }
            } else { // Tracking other frames after initialization
                if (!slamActive) {
                    break;
                }
                EM_ASM({
                    console.log("✨ Tracking points");
                });
                // Tracking points with Lucas-Kanade
                std::vector<float> err; 
                cv::calcOpticalFlowPyrLK(
                    prevGray, gray, prevTrackingPoints, trackingPoints,
                    pointStatus, err,
                    cv::Size(15, 15), 1,
                    cv::TermCriteria(cv::TermCriteria::COUNT + cv::TermCriteria::EPS, 30, 0.01)
                );
                
                // Save optical flow data
                {
                    std::lock_guard<std::mutex> lock(trackingMutex);
                    opticalFlowPrevPoints = prevTrackingPoints;
                    opticalFlowCurrPoints = trackingPoints;
                    opticalFlowStatus = pointStatus;
                    opticalFlowError = err;
                    opticalFlowReady = true;
                }
                    
                // Update previous frame and points
                gray.copyTo(prevGray);
                {
                    std::lock_guard<std::mutex> lock(trackingMutex);
                    prevTrackingPoints = trackingPoints;
                    trackingPointsCount = prevTrackingPoints.size();
                }
                    
                // Count the number of successfully tracked points
                int trackedPoints = 0;
                for (size_t i = 0; i < pointStatus.size(); i++) {
                    if (pointStatus[i]) trackedPoints++;
                }
                
                // Set the readiness flag
                {
                    std::lock_guard<std::mutex> lock(pointsReadyMutex);
                    pointsReady = true;
                }

                // Find Essential Matrix
                std::vector<uchar> inlierMask;
                cv::Mat E = cv::findEssentialMat(
                    trackingPoints,  // points of the current frame
                    prevTrackingPoints,      // points of the previous frame
                    cameraMatrix,    // camera matrix (intrinsics)
                    cv::RANSAC,      // method
                    0.999,           // probability
                    0.5,             // threshold
                    inlierMask      // inliers mask
                );
                essentialMatrix = E;  // Save in global variable
                
                // Save raw data from findEssentialMat
                {
                    std::lock_guard<std::mutex> lock(motionMutex);
                    rawEssentialMatrix = E.clone();
                    rawInlierMask = inlierMask;
                }
                
                // Recover pose from Essential Matrix
                if (!E.empty() && trackingPoints.size() >= 5 && prevTrackingPoints.size() >= 5) {
                    cv::Mat R, t;
                    std::vector<uchar> status;
                    
                    // Use recoverPose to get rotation and translation
                    cv::recoverPose(E, prevTrackingPoints, trackingPoints, cameraMatrix, R, t, status);
                    
                    // Save raw data from recoverPose
                    {
                        std::lock_guard<std::mutex> lock(motionMutex);
                        rawRotationMatrix = R.clone();
                        rawTranslationVector = t.clone();
                        rawRecoverPoseStatus = status;
                        rawDataReady = true;
                    }
                    
                    // Check if we have valid results
                    if (!R.empty() && !t.empty()) {
                        int goodPoints = cv::countNonZero(status);
                        
                        // Only update if we have enough good points
                        if (goodPoints >= 5) {
                            std::lock_guard<std::mutex> lock(motionMutex);
                            cameraRotation = R.clone();
                            cameraTranslation = t.clone();
                            goodPointsCount = goodPoints;
                            motionReady = true;
                            
                            // Log motion data for debugging
                            EM_ASM({
                                console.log("🎥 Camera motion: R[0,0]=" + $0 + ", t[0]=" + $1 + ", good points=" + $2, 
                                    $0, $1, $2);
                            }, R.at<double>(0,0), t.at<double>(0), goodPoints);
                        } else {
                            std::lock_guard<std::mutex> lock(motionMutex);
                            motionReady = false;
                        }
                    } else {
                        std::lock_guard<std::mutex> lock(motionMutex);
                        motionReady = false;
                    }
                } else {
                    std::lock_guard<std::mutex> lock(motionMutex);
                    motionReady = false;
                    rawDataReady = false;
                }
            }
                
            {
                std::lock_guard<std::mutex> lock(frameMutex);
                frameReady = false;
            }
        }
        
        // Get current tracking interval based on camera FPS
        double currentInterval;
        {
            std::lock_guard<std::mutex> lock(fpsMutex);
            currentInterval = trackingInterval;
        }
        
        // Use emscripten_sleep with dynamic interval
        emscripten_sleep(currentInterval);
    }
}

extern "C" void startTracking() {
    EM_ASM({
        console.log("✨ Tracking ✅ worker");
    });
    // Use emscripten_set_main_loop instead of thread
    emscripten_set_main_loop(trackingLoop, 0, 1);
}
