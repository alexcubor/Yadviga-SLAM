#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Tracking.h"
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
    // Структура для возврата результатов трекинга
    struct TrackingResult {
        float* points;        // Массив координат точек [x1,y1,x2,y2,...]
        uchar* status;        // Массив статусов точек
        float* errors;        // Массив ошибок
        int numPoints;        // Количество точек
    };
 
    // Function for processing a frame
    EMSCRIPTEN_KEEPALIVE
    TrackingResult* initializeTracker(uint8_t* imageData, int width, int height) {
        std::cout << "initializeTracker called with params - width: " << width << ", height: " << height << std::endl;
        
        if (!imageData) {
            std::cout << "Error: imageData is null" << std::endl;
            return nullptr;
        }
        
        if (width <= 0 || height <= 0) {
            std::cout << "Error: Invalid dimensions - width: " << width << ", height: " << height << std::endl;
            return nullptr;
        }
        
        try {
            std::cout << "Creating frame from image data..." << std::endl;
            // Create cv::Mat from image data
            cv::Mat frame(height, width, CV_8UC4, imageData);
            
            std::cout << "Converting to grayscale..." << std::endl;
            cv::Mat grayFrame;
            cv::cvtColor(frame, grayFrame, cv::COLOR_RGBA2GRAY);
            
            if (!isInitialized && bbox.width > 0 && bbox.height > 0) {
                std::cout << "Initializing tracking points in bbox..." << std::endl;
                // Find points to track inside the bbox
                cv::Mat mask = cv::Mat::zeros(frame.size(), CV_8UC1);
                cv::rectangle(mask, bbox, cv::Scalar(255), -1);
                
                cv::goodFeaturesToTrack(grayFrame, prevPoints, 50, 0.01, 10, mask);
                if (prevPoints.empty()) {
                    std::cout << "No points found to track in the region" << std::endl;
                    return nullptr;
                }
                
                std::cout << "Found " << prevPoints.size() << " points to track" << std::endl;
                prevFrame = grayFrame.clone();
                isInitialized = true;
            }
            
            if (isInitialized) {
                if (prevFrame.empty()) {
                    std::cout << "Error: Previous frame is empty" << std::endl;
                    return nullptr;
                }
                
                std::cout << "Calculating optical flow..." << std::endl;
                cv::calcOpticalFlowPyrLK(prevFrame, grayFrame, prevPoints, nextPoints, status, err);
                
                if (!nextPoints.empty()) {
                    std::cout << "Processing " << nextPoints.size() << " tracked points" << std::endl;
                    std::vector<cv::Point2f> goodNew;
                    std::vector<cv::Point2f> goodOld;
                    
                    for (size_t i = 0; i < nextPoints.size(); i++) {
                        if (status[i]) {
                            goodNew.push_back(nextPoints[i]);
                            goodOld.push_back(prevPoints[i]);
                        }
                    }
                    
                    std::cout << "Good points after filtering: " << goodNew.size() << std::endl;
                    
                    if (!goodNew.empty()) {
                        // Calculate average point displacement
                        cv::Point2f meanShift(0, 0);
                        for (size_t i = 0; i < goodNew.size(); i++) {
                            meanShift += goodNew[i] - goodOld[i];
                        }
                        meanShift *= 1.0f / goodNew.size();
                        
                        std::cout << "Mean shift - x: " << meanShift.x << ", y: " << meanShift.y << std::endl;
                        
                        // Update bbox position
                        bbox.x += meanShift.x;
                        bbox.y += meanShift.y;
                        
                        prevPoints = goodNew;
                        prevFrame = grayFrame.clone();
                    }
                } else {
                    std::cout << "No points were tracked in this frame" << std::endl;
                }
            }
            
            std::cout << "Creating tracking result..." << std::endl;
            TrackingResult* result = new TrackingResult();
            // ... заполнение результата ...
            
            std::cout << "Tracking completed successfully" << std::endl;
            return result;
            
        } catch (const cv::Exception& e) {
            std::cout << "OpenCV error: " << e.what() << std::endl;
            return nullptr;
        } catch (const std::exception& e) {
            std::cout << "Standard error: " << e.what() << std::endl;
            return nullptr;
        } catch (...) {
            std::cout << "Unknown error occurred" << std::endl;
            return nullptr;
        }
    }
    
    // Function for clearing memory
    EMSCRIPTEN_KEEPALIVE
    void freeTrackingResult(TrackingResult* result) {
        if (result) {
            delete[] result->points;
            delete[] result->status;
            delete[] result->errors;
            delete result;
        }
    }
}