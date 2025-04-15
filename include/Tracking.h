#ifndef TRACKING_H
#define TRACKING_H

#include <emscripten.h>
#include <opencv2/opencv.hpp>
#include <vector>

// Structure for tracking results
struct TrackingResult {
    float* points;      // Array of point coordinates (x1,y1,x2,y2,...)
    int numPoints;      // Number of points
    float* status;      // Status of each point (1 - successfully tracked, 0 - lost)
};

#ifdef __cplusplus
extern "C" {
#endif

// Initialize tracker
EMSCRIPTEN_KEEPALIVE
TrackingResult* initializeTracker();

// Internal C++ function for processing frame data
EMSCRIPTEN_KEEPALIVE
TrackingResult* _initializeTracker(uint8_t* imageData, int width, int height);

#ifdef __cplusplus
}
#endif

#endif // TRACKING_H
