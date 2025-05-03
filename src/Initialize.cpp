#include <emscripten.h>
#include <iostream>

extern "C" void renderFrame();
extern "C" void startTracking();
extern "C" void renderTrackingPoints();


// Autorun function
int main() {
    std::cout << "Initialize.cpp ✅" << std::endl;
    renderFrame();
    startTracking();
    

    // ========================================================================================
    // Optional test functions
    // ========================================================================================

    // Check if the canvas has the attribute render-tracking
    EM_ASM_({
        const canvas = document.getElementById('xr-canvas');
        if (canvas && canvas.hasAttribute('render-tracking')) {
            Module._renderTrackingPoints();
        }
    });
}
