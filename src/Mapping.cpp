#include <emscripten.h>
#include <emscripten/threading.h>
#include <opencv2/opencv.hpp>
#include <opencv2/calib3d.hpp>
#include <thread>
#include <atomic>

// Global variables for mapping
EMSCRIPTEN_KEEPALIVE std::vector<cv::Point3f> mapPoints;  // 3D points of the map
EMSCRIPTEN_KEEPALIVE cv::Mat cameraPose = cv::Mat::eye(4, 4, CV_32F);  // Camera position
EMSCRIPTEN_KEEPALIVE std::atomic<bool> mappingReady{false};  // Flag of mapping ready

// External variables from Tracking
extern std::vector<cv::Point2f> trackingPoints;
extern std::vector<cv::Point2f> prevTrackingPoints;
extern std::vector<uchar> pointStatus;
extern uint8_t* pointDescriptors;
extern cv::Mat essentialMatrix;
extern cv::Mat cameraMatrix;
extern std::atomic<bool> pointsReady;

void mappingThread() {
    while (true) {
        if (pointsReady.load(std::memory_order_acquire)) {
            // Get Essential Matrix
            cv::Mat E = essentialMatrix;
            if (!E.empty()) {
                // Restore R and t from Essential Matrix
                cv::Mat R, t;
                cv::recoverPose(E, prevTrackingPoints, trackingPoints, cameraMatrix, R, t, pointStatus);

                // P1 - projection matrix for the first frame (accept it as the origin)
                cv::Mat P1 = cameraMatrix * cv::Mat::eye(3, 4, CV_32F);

                // P2 - projection matrix for the second frame (with camera movement)
                cv::Mat newPose = cv::Mat::eye(4, 4, CV_32F);
                R.copyTo(newPose(cv::Rect(0, 0, 3, 3)));  // copy rotation
                t.copyTo(newPose(cv::Rect(3, 0, 1, 3)));  // copy translation
                cv::Mat P2 = cameraMatrix * newPose(cv::Rect(0, 0, 4, 3));

                // Triangulation of points
                cv::Mat points4D;  // output: homogeneous coordinates of 3D points
                cv::triangulatePoints(
                    P1,            // projection matrix of the first frame
                    P2,            // projection matrix of the second frame
                    prevTrackingPoints,    // points of the first frame
                    trackingPoints, // points of the second frame
                    points4D       // output: homogeneous coordinates of 3D points
                );

                // Convert to normal 3D coordinates
                std::vector<cv::Point3f> points3D;
                for (int i = 0; i < points4D.cols; i++) {
                    cv::Mat x = points4D.col(i);
                    x = x / x.at<float>(3);  // делим на w-координату
                    points3D.push_back(cv::Point3f(
                        x.at<float>(0),  // X
                        x.at<float>(1),  // Y
                        x.at<float>(2)   // Z
                    ));
                }

                // Add new points to the map
                mapPoints.insert(mapPoints.end(), points3D.begin(), points3D.end());
                
                // Update camera position
                cameraPose = newPose;
                
                // Mark that mapping is ready
                mappingReady.store(true, std::memory_order_release);
            }
        }
    }
}


extern "C" void startMapping() {
    EM_ASM({
        console.log("Mapping.cpp ✅ thread 2");
    });
    std::thread t(mappingThread);
    t.detach();  // Detach the thread
}
