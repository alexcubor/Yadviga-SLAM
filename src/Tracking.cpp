#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Tracking.h"
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <vector>


// ============================================================================
// JavaScript
// ============================================================================

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    TrackingResult* initializeTracker() {
        EM_ASM_({

            
            // ============================================================================
            // Initialize tracker
            // ============================================================================

            // 1. Get image data with willReadFrequently optimization
            const ctx = window.canvas.getContext('2d', { willReadFrequently: true });
            
            function findInitialPoints() {
                const imageData = ctx.getImageData(0, 0, window.canvas.width, window.canvas.height);
                const data = new Uint8Array(imageData.data);  // Create a view of the image data
                const buffer = Module._malloc(data.length);  // Allocate memory in the Emscripten heap
                Module.HEAPU8.set(data, buffer);  // Copy the image data to the Emscripten heap

                // 2. Try to find initial points
                const result = Module.ccall('_initializeTracker', 'number', 
                    ['number', 'number', 'number'], 
                    [buffer, window.canvas.width, window.canvas.height]);

                // 3. Get points from address in memory
                const pointsPtr = HEAP32[result / 4];
                const statusPtr = HEAP32[result / 4 + 2];
                const numPoints = HEAP32[result / 4 + 1];
                
                // 4. Check if points were found
                if (numPoints > 0) {
                    // Points found, store them
                    window.trackingPoints = [];
                    for (let i = 0; i < numPoints; i++) {
                        window.trackingPoints.push({
                            x: HEAPF32[pointsPtr / 4 + i * 2],
                            y: HEAPF32[pointsPtr / 4 + i * 2 + 1],
                            status: HEAPF32[statusPtr / 4 + i]
                        });
                    }

                    // Free memory
                    Module._free(buffer);
                    Module.ccall('freeTrackingResult', 'void', ['number'], [result]);

                    // Start continuous tracking
                    function trackPoints() {
                        const imageData = ctx.getImageData(0, 0, window.canvas.width, window.canvas.height);
                        const data = new Uint8Array(imageData.data);
                        const buffer = Module._malloc(data.length);
                        Module.HEAPU8.set(data, buffer);

                        // Track points using Lucas-Kanade
                        const trackResult = Module.ccall('_trackPoints', 'number',
                            ['number', 'number', 'number'],
                            [buffer, window.canvas.width, window.canvas.height]);

                        if (trackResult) {
                            // Update tracking points
                            const newPointsPtr = HEAP32[trackResult / 4];
                            const newStatusPtr = HEAP32[trackResult / 4 + 2];
                            const newNumPoints = HEAP32[trackResult / 4 + 1];
                            
                            window.trackingPoints = [];
                            for (let i = 0; i < newNumPoints; i++) {
                                window.trackingPoints.push({
                                    x: HEAPF32[newPointsPtr / 4 + i * 2],
                                    y: HEAPF32[newPointsPtr / 4 + i * 2 + 1],
                                    status: HEAPF32[newStatusPtr / 4 + i]
                                });
                            }

                            // Free memory
                            Module._free(buffer);
                            Module.ccall('freeTrackingResult', 'void', ['number'], [trackResult]);

                            // Request next frame
                            requestAnimationFrame(trackPoints);
                        } else {
                            // Tracking failed, try to find new points
                            Module._free(buffer);
                            findInitialPoints();
                        }
                    }

                    // Start tracking loop
                    trackPoints();
                } else {
                    // No points found, try again
                    Module._free(buffer);
                    Module.ccall('freeTrackingResult', 'void', ['number'], [result]);
                    requestAnimationFrame(findInitialPoints);
                }
            }

            // Start looking for points
            findInitialPoints();
        });
        
        return nullptr;
    }
    
    
    // ============================================================================
    // C++
    // ============================================================================

    // Global variables for tracking state
    static cv::Mat prevGray;
    static std::vector<cv::Point2f> prevPoints;
    static bool isInitialized = false;

    EMSCRIPTEN_KEEPALIVE
    TrackingResult* _initializeTracker(uint8_t* imageData, int width, int height) {
        // Create OpenCV Mat from the image data
        cv::Mat frame(height, width, CV_8UC4, imageData);
        
        // Convert to grayscale
        cv::Mat gray;
        cv::cvtColor(frame, gray, cv::COLOR_RGBA2GRAY);
        
        // Find good features to track
        std::vector<cv::Point2f> corners;
        cv::goodFeaturesToTrack(gray, corners, 25, 0.01, 10);
        
        // Store for tracking
        gray.copyTo(prevGray);
        prevPoints = corners;
        isInitialized = true;
        
        // Create result structure
        TrackingResult* result = new TrackingResult();
        
        if (!corners.empty()) {
            result->numPoints = corners.size();
            result->points = new float[corners.size() * 2];
            result->status = new float[corners.size()];
            
            for (size_t i = 0; i < corners.size(); i++) {
                result->points[i * 2] = corners[i].x;
                result->points[i * 2 + 1] = corners[i].y;
                result->status[i] = 1.0f;
            }
        } else {
            result->numPoints = 0;
            result->points = nullptr;
            result->status = nullptr;
        }

        // Output result:
        // ============================================================================
        // numPoints: Number of points
        // points: Left indent point, Top indent point
        // status: 1.0 if point is valid, 0.0 if point is invalid
        // ============================================================================

        return result;
    }

    EMSCRIPTEN_KEEPALIVE
    TrackingResult* _trackPoints(uint8_t* imageData, int width, int height) {
        if (!isInitialized || prevPoints.empty()) {
            return nullptr;
        }

        // Create OpenCV Mat from the current frame
        cv::Mat frame(height, width, CV_8UC4, imageData);
        
        // Convert current frame to grayscale
        cv::Mat gray;
        cv::cvtColor(frame, gray, cv::COLOR_RGBA2GRAY);
        
        // Track points using Lucas-Kanade
        std::vector<cv::Point2f> nextPoints;
        std::vector<uchar> status;
        std::vector<float> err;
        
        cv::calcOpticalFlowPyrLK(
            prevGray, gray, prevPoints, nextPoints,
            status, err,
            cv::Size(21, 21), 3,
            cv::TermCriteria(cv::TermCriteria::COUNT + cv::TermCriteria::EPS, 30, 0.01)
        );
        
        // Update previous frame and points
        gray.copyTo(prevGray);
        prevPoints = nextPoints;
        
        // Create result structure
        TrackingResult* result = new TrackingResult();
        result->numPoints = nextPoints.size();
        result->points = new float[nextPoints.size() * 2];
        result->status = new float[nextPoints.size()];
        
        for (size_t i = 0; i < nextPoints.size(); i++) {
            result->points[i * 2] = nextPoints[i].x;
            result->points[i * 2 + 1] = nextPoints[i].y;
            result->status[i] = status[i];
        }

        return result;
    }


    // ============================================================================
    // Free memory
    // ============================================================================ 

    EMSCRIPTEN_KEEPALIVE
    void freeTrackingResult(TrackingResult* result) {
        if (result->points) delete[] result->points;
        if (result->status) delete[] result->status;
        delete result;
    }
}