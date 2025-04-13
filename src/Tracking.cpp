#include <emscripten.h>
#include <iostream>
#include <string>
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <vector>

// Global variables for tracker state
std::vector<cv::Point2f> prevPoints;
std::vector<cv::Point2f> nextPoints;
std::vector<uchar> status;
std::vector<float> err;
cv::Mat prevFrame;
cv::Rect2d bbox;
bool isInitialized = false;

// Define functions to be exported to JavaScript
extern "C" {
    
    EMSCRIPTEN_KEEPALIVE
    void initializeTracker(const char*) {
        // No special initialization required for Lucas-Kanade
        isInitialized = false;
        prevPoints.clear();
        nextPoints.clear();
    }
    
    // Function for processing a frame
    EMSCRIPTEN_KEEPALIVE
    bool processFrame(uint8_t* imageData, int width, int height) {
        if (!imageData || width <= 0 || height <= 0) {
            return false;
        }
        
        try {
            // Create cv::Mat from image data
            cv::Mat frame(height, width, CV_8UC4, imageData);
            cv::Mat grayFrame;
            cv::cvtColor(frame, grayFrame, cv::COLOR_RGBA2GRAY);
            
            if (!isInitialized && bbox.width > 0 && bbox.height > 0) {
                // Find points to track inside the bbox
                cv::Mat mask = cv::Mat::zeros(frame.size(), CV_8UC1);
                cv::rectangle(mask, bbox, cv::Scalar(255), -1);
                
                cv::goodFeaturesToTrack(grayFrame, prevPoints, 50, 0.01, 10, mask);
                if (prevPoints.empty()) {
                    std::cout << "No points found to track" << std::endl;
                    return false;
                }
                
                prevFrame = grayFrame.clone();
                isInitialized = true;
                return true;
            }
            
            if (isInitialized) {
                if (prevFrame.empty()) {
                    std::cout << "Previous frame is empty" << std::endl;
                    return false;
                }
                
                // Calculate optical flow
                cv::calcOpticalFlowPyrLK(prevFrame, grayFrame, prevPoints, nextPoints, status, err);
                
                // Update bbox based on point movement
                if (!nextPoints.empty()) {
                    std::vector<cv::Point2f> goodNew;
                    std::vector<cv::Point2f> goodOld;
                    
                    for (size_t i = 0; i < nextPoints.size(); i++) {
                        if (status[i]) {
                            goodNew.push_back(nextPoints[i]);
                            goodOld.push_back(prevPoints[i]);
                        }
                    }
                    
                    if (!goodNew.empty()) {
                        // Calculate average point displacement
                        cv::Point2f meanShift(0, 0);
                        for (size_t i = 0; i < goodNew.size(); i++) {
                            meanShift += goodNew[i] - goodOld[i];
                        }
                        meanShift *= 1.0f / goodNew.size();
                        
                        // Update bbox position
                        bbox.x += meanShift.x;
                        bbox.y += meanShift.y;
                        
                        // Update points and frame for next iteration
                        prevPoints = goodNew;
                        prevFrame = grayFrame.clone();
                        return true;
                    }
                }
                
                // If points are lost, reset the tracker
                isInitialized = false;
            }
            
            return false;
        } catch (const cv::Exception& e) {
            std::cout << "OpenCV error: " << e.what() << std::endl;
            return false;
        } catch (const std::exception& e) {
            std::cout << "Error: " << e.what() << std::endl;
            return false;
        }
    }
    
    // Function for setting the tracking region
    EMSCRIPTEN_KEEPALIVE
    void setTrackingRegion(int x, int y, int width, int height) {
        bbox = cv::Rect2d(x, y, width, height);
        isInitialized = false;
    }
    
    // Function for getting the current tracking region
    EMSCRIPTEN_KEEPALIVE
    void getTrackingRegion(int* x, int* y, int* width, int* height) {
        if (x) *x = static_cast<int>(bbox.x);
        if (y) *y = static_cast<int>(bbox.y);
        if (width) *width = static_cast<int>(bbox.width);
        if (height) *height = static_cast<int>(bbox.height);
    }
}