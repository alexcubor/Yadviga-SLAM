#ifndef INITIALIZE_H
#define INITIALIZE_H

#include <stdint.h> // For uint8_t

// Function declarations for WebAssembly export
extern "C" {
    void initializeSLAM(uint8_t* canvasData);
}

#endif // INITIALIZE_H