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

            // 1. Get image data
            const ctx = window.canvas.getContext('2d');

            setTimeout(function() {
                const imageData = ctx.getImageData(0, 0, window.canvas.width, window.canvas.height);
                const data = new Uint8Array(imageData.data);  // Create a view of the image data
                const buffer = Module._malloc(data.length);  // Allocate memory in the Emscripten heap
                Module.HEAPU8.set(data, buffer);  // Copy the image data to the Emscripten heap

                // 2. Calculate tracking points from video
                const result = Module.ccall('_initializeTracker', 'number', 
                    ['number', 'number', 'number'], 
                    [buffer, window.canvas.width, window.canvas.height]);

                // 3. Get points from address in memory
                const pointsPtr = HEAP32[result / 4];
                const statusPtr = HEAP32[result / 4 + 2];
                const numPoints = HEAP32[result / 4 + 1];
                window.trackingPoints = [];
                for (let i = 0; i < numPoints; i++) {
                    window.trackingPoints.push({
                        x: HEAPF32[pointsPtr / 4 + i * 2],
                        y: HEAPF32[pointsPtr / 4 + i * 2 + 1],
                        status: HEAPF32[statusPtr / 4 + i]
                    });
                }

                // 4. Free all allocated memory
                Module._free(buffer);  // Free image data buffer
                Module.ccall('freeTrackingResult', 'void', ['number'], [result]);  // Free tracking result structure

            }, 1000);
        });
        
        return nullptr;
    }
    
    
    // ============================================================================
    // C++
    // ============================================================================

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
        
        // Create result structure
        TrackingResult* result = new TrackingResult();
        
        if (!corners.empty()) {
            // Use all found corners
            result->numPoints = corners.size();
            result->points = new float[corners.size() * 2];  // x and y for each point
            result->status = new float[corners.size()];     // status for each point
            
            // Copy all corners to result
            for (size_t i = 0; i < corners.size(); i++) {
                result->points[i * 2] = corners[i].x;      // x coordinate
                result->points[i * 2 + 1] = corners[i].y;  // y coordinate
                result->status[i] = 1.0f;                  // mark as valid point
            }
        } else {
            // If no corners found, use center point
            result->numPoints = 1;
            result->points = new float[2] {width / 2.0f, height / 2.0f};
            result->status = new float[1] {0.0f};  // Mark as invalid point
        }

        // Output result:
        // ============================================================================
        // numPoints: Number of points
        // points: Left indent point, Top indent point
        // status: 1.0 if point is valid, 0.0 if point is invalid
        // ============================================================================

        return result;
    }


    // ============================================================================
    // Free memory
    // ============================================================================ 

    EMSCRIPTEN_KEEPALIVE
    void freeTrackingResult(TrackingResult* result) {
        delete[] result->points;
        delete[] result->status;
        delete result;
    }
}