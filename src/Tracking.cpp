#include <emscripten.h>
#include <emscripten/threading.h>
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <thread>
#include <atomic>

// Global variables for tracking
EMSCRIPTEN_KEEPALIVE float* trackingPoints = nullptr;  // Buffer for tracking points
EMSCRIPTEN_KEEPALIVE std::atomic<int> trackingPointsCount{0};  // Number of tracking points
EMSCRIPTEN_KEEPALIVE std::atomic<bool> pointsReady{false};  // Flag for points readiness

// Declare external variables
extern std::atomic<bool> frameReady;
extern uint8_t* frameBuffer;
extern int frameWidth;
extern int frameHeight;

// Functions for accessing tracking points
extern "C" float* getTrackingPoints() {
    return trackingPoints;
}

extern "C" int getTrackingPointsCount() {
    return trackingPointsCount.load(std::memory_order_acquire);
}

extern "C" bool arePointsReady() {
    return pointsReady.load(std::memory_order_acquire);
}

void trackingThread() {
    EM_ASM({
        self.trackingFrameCount = 0;
    });
    
    // Static variables for tracking
    static bool isInitialized = false;
    static cv::Mat prevGray;
    static std::vector<cv::Point2f> prevPoints;
    
    while (true) {
        bool isReady = frameReady.load(std::memory_order_acquire);
        
        if (isReady) {
            // EM_ASM({
            //     self.trackingFrameCount++;
            //     console.log("Tracking: Frame ready now:", Module._getFrameReady(), "Frame count:", self.trackingFrameCount);
            //     const frameData = new Uint8Array(Module.HEAPU8.buffer, Module._getFrameBuffer(), Module._getFrameBufferSize());
            //     console.log("Tracking: Frame buffer:", frameData);
            // });

            cv::Mat frame(frameHeight, frameWidth, CV_8UC4, frameBuffer);

            // Convert current frame to grayscale
            cv::Mat gray;
            cv::cvtColor(frame, gray, cv::COLOR_RGBA2GRAY);
                
            if (!isInitialized || prevPoints.empty()) { // Filter out black frames through if, and real frames in else
                EM_ASM_DOUBLE({
                    console.log("TRACKING: Initializing points");
                    return 0.0;
                });
                    
                // Initialize at first frame
                std::vector<cv::Point2f> corners;
                cv::goodFeaturesToTrack(gray, corners, 25, 0.01, 10);
                prevGray = gray.clone();
                prevPoints = corners;
                isInitialized = true;
                
                // Write points to buffer
                if (trackingPoints) {
                    free(trackingPoints);
                }
                trackingPoints = (float*)malloc(corners.size() * 2 * sizeof(float));
                for (size_t i = 0; i < corners.size(); i++) {
                    trackingPoints[i * 2] = corners[i].x / frameWidth * 2 - 1;
                    trackingPoints[i * 2 + 1] = corners[i].y / frameHeight * 2 - 1;
                }
                
                // Atomically update the number of points and set the readiness flag
                trackingPointsCount.store(corners.size(), std::memory_order_release);
                pointsReady.store(true, std::memory_order_release);
                
                // Log original coordinates
                // EM_ASM({
                //     const pointsCount = $0;
                //     const pointsPtr = $1;
                //     const points = new Float32Array(Module.HEAPF32.buffer, pointsPtr, pointsCount * 2);
                //     console.log("TRACKING: Points data:", Array.from(points));
                // }, corners.size(), trackingPoints);
            } else {
                EM_ASM_DOUBLE({
                    console.log("TRACKING: Tracking points");
                    return 0.0;
                });
                // Tracking points with Lucas-Kanade
                std::vector<cv::Point2f> nextPoints;
                std::vector<uchar> status;
                std::vector<float> err; cv::calcOpticalFlowPyrLK(
                    prevGray, gray, prevPoints, nextPoints,
                    status, err,
                    cv::Size(21, 21), 3,
                    cv::TermCriteria(cv::TermCriteria::COUNT + cv::TermCriteria::EPS, 30, 0.01)
                );
                    
                // Update previous frame and points
                gray.copyTo(prevGray);
                prevPoints = nextPoints;
                    
                // Count the number of successfully tracked points
                int trackedPoints = 0;
                for (size_t i = 0; i < status.size(); i++) {
                    if (status[i]) trackedPoints++;
                }

                // Update tracking points in WebGL
                if (trackingPoints) {
                    free(trackingPoints);
                }
                trackingPoints = (float*)malloc(prevPoints.size() * 2 * sizeof(float));
                for (size_t i = 0; i < prevPoints.size(); i++) {
                    trackingPoints[i * 2] = prevPoints[i].x / frameWidth * 2 - 1;
                    trackingPoints[i * 2 + 1] = prevPoints[i].y / frameHeight * 2 - 1;
                }
                
                // Atomically update the number of points and set the readiness flag
                trackingPointsCount.store(prevPoints.size(), std::memory_order_release);
                pointsReady.store(true, std::memory_order_release);
            }
                
            // Give time for processing the next frame
            // emscripten_thread_sleep(8); // ~60 FPS = (16)
            frameReady.store(false, std::memory_order_release);
        } else {
            // emscripten_thread_sleep(8);
        }
    }
}

extern "C" void startTracking() {
    EM_ASM({
        console.log("Tracking.cpp ✅ thread 1");
    });
    std::thread t(trackingThread);
    t.detach();  // Detach the thread
}
