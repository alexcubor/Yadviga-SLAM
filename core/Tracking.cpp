#include <emscripten.h>
#include <emscripten/threading.h>
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <mutex>

// Global variables for tracking
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> trackingPoints;  // Buffer for tracking points
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point2f> prevTrackingPoints;  // Buffer for previous points
EMSCRIPTEN_KEEPALIVE int trackingPointsCount = 0;  // Number of tracking points
EMSCRIPTEN_KEEPALIVE bool pointsReady = false;  // Flag for points readiness
EMSCRIPTEN_KEEPALIVE std::vector<uchar> pointStatus;  // Status of each point (1 if tracked, 0 if lost)
EMSCRIPTEN_KEEPALIVE uint8_t* pointDescriptors = nullptr;  // Descriptors for each point
EMSCRIPTEN_KEEPALIVE size_t descriptorSize = 32;  // Fixed size for ORB descriptors
EMSCRIPTEN_KEEPALIVE cv::Mat essentialMatrix;  // Essential Matrix

// Mutexes for thread safety
EMSCRIPTEN_KEEPALIVE std::mutex trackingMutex;  // Mutex for tracking points
EMSCRIPTEN_KEEPALIVE std::mutex pointsReadyMutex;  // Mutex for points readiness

// Declare external variables
extern bool frameReady;
extern std::mutex frameMutex;
extern uint8_t* frameBuffer;
extern int frameWidth;
extern int frameHeight;
extern cv::Mat cameraMatrix;

// Functions for accessing tracking points
extern "C" float* getTrackingPoints() {
    std::lock_guard<std::mutex> lock(trackingMutex);
    float* points = (float*)malloc(trackingPoints.size() * 2 * sizeof(float));
    
    for (size_t i = 0; i < trackingPoints.size(); i++) {
        // Normalize coordinates when sending
        points[i * 2] = (trackingPoints[i].x / frameWidth) * 2 - 1;  // x
        points[i * 2 + 1] = (trackingPoints[i].y / frameHeight) * 2 - 1;  // y
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

                    for (const auto& corner : corners) {
                        trackingPoints.push_back(corner);  // Save in pixels
                        prevTrackingPoints.push_back(corner);  // Save in pixels
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
                EM_ASM({
                    console.log("✨ Tracking points");
                });
                // Tracking points with Lucas-Kanade
                std::vector<float> err; 
                cv::calcOpticalFlowPyrLK(
                    prevGray, gray, prevTrackingPoints, trackingPoints,
                    pointStatus, err,
                    cv::Size(21, 21), 3,
                    cv::TermCriteria(cv::TermCriteria::COUNT + cv::TermCriteria::EPS, 30, 0.01)
                );
                    
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
                cv::Mat E = cv::findEssentialMat(
                    trackingPoints,  // points of the current frame
                    prevTrackingPoints,      // points of the previous frame
                    cameraMatrix,    // camera matrix (intrinsics)
                    cv::RANSAC,      // method
                    0.999,           // probability
                    1.0,             // threshold
                    pointStatus      // inliers mask
                );
                essentialMatrix = E;  // Save in global variable
            }
                
            {
                std::lock_guard<std::mutex> lock(frameMutex);
                frameReady = false;
            }
        }
        
        // Use emscripten_sleep instead of thread sleep
        emscripten_sleep(8);
    }
}

extern "C" void startTracking() {
    EM_ASM({
        console.log("✨ Tracking ✅ worker");
    });
    // Use emscripten_set_main_loop instead of thread
    emscripten_set_main_loop(trackingLoop, 0, 1);
}
