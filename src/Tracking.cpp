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
                const buffer = imageData.data.buffer;

                // 2. Calculate tracking points from video
                const result = Module.ccall('_initializeTracker', 'number', 
                    ['number', 'number', 'number'], 
                    [buffer, window.canvas.width, window.canvas.height]);

                // 3. Get points from address in memory
                const pointsPtr = HEAP32[result / 4];
                const statusPtr = HEAP32[result / 4 + 2];
                window.trackingPoints = {
                    x: HEAPF32[pointsPtr / 4],
                    y: HEAPF32[pointsPtr / 4 + 1],
                    status: HEAPF32[statusPtr / 4]
                };

                // 4. Free memory to avoid memory leaks
                Module.ccall('freeTrackingResult', 'void', ['number'], [result]);
            }, 1000);
        });
        
        return nullptr;
    }
    
    
    // ============================================================================
    // C++
    // ============================================================================

    EMSCRIPTEN_KEEPALIVE
    TrackingResult* _initializeTracker(uint8_t* imageData, int width, int height) {
        std::cout << "imageData: " << imageData << std::endl;

        // Create result with one point for testing
        TrackingResult* result = new TrackingResult();
        result->numPoints = 1;  // One point for testing

        // Allocate memory for one point and its status
        result->points = new float[2] {width / 2.0f, height / 2.0f};  // x and y
        result->status = new float[1] {1.0f};  // one status


        // Output result:
        // ============================================================================
        // points: Left indent point, Top indent point
        // status: 1.0
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