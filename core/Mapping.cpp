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

// Function to get number of map points
extern "C" {
    EMSCRIPTEN_KEEPALIVE int getMapPointsCount() {
        return mapPoints.size();
    }
    
    // Function to get map points
    EMSCRIPTEN_KEEPALIVE void getMapPoints(float* points) {
        for (size_t i = 0; i < mapPoints.size(); i++) {
            points[i * 3] = mapPoints[i].x;
            points[i * 3 + 1] = mapPoints[i].y;
            points[i * 3 + 2] = mapPoints[i].z;
        }
    }
}

void mappingThread() {
    EM_ASM({
        console.log("🗺️ Mapping: Starting mapping thread");
    });

    while (true) {
        if (pointsReady.load(std::memory_order_acquire)) {
            EM_ASM({
                console.log("🗺️ Mapping: Points are ready");
            });

            // Get Essential Matrix
            cv::Mat E = essentialMatrix;
            
            // Check if we have enough points and essential matrix
            if (!E.empty() && trackingPoints.size() >= 5 && prevTrackingPoints.size() >= 5) {
                size_t numPoints = trackingPoints.size();
                EM_ASM({
                    console.log("🗺️ Mapping: Processing frame with " + $0 + " points", $0);
                }, numPoints);

                try {
                    // Check if points are within image bounds
                    bool pointsValid = true;
                    for (const auto& pt : trackingPoints) {
                        if (pt.x < 0 || pt.y < 0 || pt.x >= 640 || pt.y >= 480) {
                            pointsValid = false;
                            break;
                        }
                    }
                    for (const auto& pt : prevTrackingPoints) {
                        if (pt.x < 0 || pt.y < 0 || pt.x >= 640 || pt.y >= 480) {
                            pointsValid = false;
                            break;
                        }
                    }
                    
                    if (!pointsValid) {
                        EM_ASM({
                            console.log("🗺️ Mapping: Points out of bounds, skipping");
                        });
                        continue;
                    }

                    // Log point coordinates for debugging
                    for (size_t i = 0; i < std::min(size_t(5), trackingPoints.size()); i++) {
                        EM_ASM({
                            console.log("🗺️ Mapping: Point " + $0 + " - prev: (" + $1 + "," + $2 + "), curr: (" + $3 + "," + $4 + ")",
                                $0, $1, $2, $3, $4);
                        }, i, 
                            prevTrackingPoints[i].x, prevTrackingPoints[i].y,
                            trackingPoints[i].x, trackingPoints[i].y);
                    }
                    
                    // Restore R and t from Essential Matrix
                    cv::Mat R, t;
                    std::vector<uchar> status;
                    EM_ASM({
                        console.log("🗺️ Mapping: Recovering pose");
                    });

                    // Use the correct recoverPose signature
                    cv::recoverPose(E, prevTrackingPoints, trackingPoints, cameraMatrix, R, t, status);
                    
                    // Check result
                    if (R.empty() || t.empty()) {
                        EM_ASM({
                            console.log("🗺️ Mapping: Invalid R or t, skipping");
                        });
                        continue;
                    }
                    
                    // Check if we have enough good points
                    int goodPoints = cv::countNonZero(status);
                    if (goodPoints < 5) {
                        EM_ASM({
                            console.log("🗺️ Mapping: Not enough good points (" + $0 + "), skipping", $0);
                        }, goodPoints);
                        continue;
                    }
                    
                    EM_ASM({
                        console.log("🗺️ Mapping: Found " + $0 + " good points", $0);
                    }, goodPoints);

                    // Log rotation and translation for debugging
                    EM_ASM({
                        console.log("🗺️ Mapping: R[0,0]=" + $0 + ", t[0]=" + $1, $0, $1);
                    }, R.at<double>(0,0), t.at<double>(0));
                    
                    // P1 - projection matrix for the first frame (accept it as the origin)
                    cv::Mat P1 = cameraMatrix * cv::Mat::eye(3, 4, CV_32F);

                    // P2 - projection matrix for the second frame (with camera movement)
                    cv::Mat newPose = cv::Mat::eye(4, 4, CV_32F);
                    R.copyTo(newPose(cv::Rect(0, 0, 3, 3)));  // copy rotation
                    t.copyTo(newPose(cv::Rect(3, 0, 1, 3)));  // copy translation
                    cv::Mat P2 = cameraMatrix * newPose(cv::Rect(0, 0, 4, 3));

                    EM_ASM({
                        console.log("🗺️ Mapping: Triangulating points");
                    });

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
                        x = x / x.at<float>(3);  // divide by w-coordinate
                        points3D.push_back(cv::Point3f(
                            x.at<float>(0),  // X
                            x.at<float>(1),  // Y
                            x.at<float>(2)   // Z
                        ));
                    }

                    // Log first few 3D points for debugging
                    for (size_t i = 0; i < std::min(size_t(5), points3D.size()); i++) {
                        EM_ASM({
                            console.log("🗺️ Mapping: 3D Point " + $0 + " = (" + $1 + "," + $2 + "," + $3 + ")",
                                $0, $1, $2, $3);
                        }, i, points3D[i].x, points3D[i].y, points3D[i].z);
                    }

                    // Add new points to the map
                    mapPoints.insert(mapPoints.end(), points3D.begin(), points3D.end());
                    
                    // Update camera position
                    cameraPose = newPose;
                    
                    size_t newPoints = points3D.size();
                    size_t totalPoints = mapPoints.size();
                    EM_ASM({
                        console.log("🗺️ Mapping: Added " + $0 + " new points to map (total: " + $1 + ")", $0, $1);
                    }, newPoints, totalPoints);
                    
                    // Mark that mapping is ready
                    mappingReady.store(true, std::memory_order_release);
                    
                } catch (const cv::Exception& e) {
                    EM_ASM({
                        console.log("🗺️ Mapping: OpenCV error occurred");
                    });
                } catch (const std::exception& e) {
                    EM_ASM({
                        console.log("🗺️ Mapping: Standard error occurred");
                    });
                }
            } else {
                EM_ASM({
                    console.log("🗺️ Mapping: Not enough points or empty E matrix");
                });
            }
        }
    }
}

extern "C" void startMapping() {
    EM_ASM({
        console.log("⛳️ Mapping ✅ thread 2");
    });
    std::thread t(mappingThread);
    t.detach();  // Detach the thread
}
