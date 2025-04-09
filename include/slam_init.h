#ifndef SLAM_INIT_H
#define SLAM_INIT_H

#include <stdint.h> // For uint8_t

// Function declarations for WebAssembly export
extern "C" {
    void initializeSLAM(uint8_t* canvasData);
}

#endif // SLAM_INIT_H