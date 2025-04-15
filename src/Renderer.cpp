#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Renderer.h"
#include "../include/Tracking.h"

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeRenderer() {
        EM_ASM_({
            // Get global variables
            const canvas = window.canvas;
            const ctx = canvas.getContext("2d");
            
            // Function to render the video frame on the canvas
            function renderFrame() {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(50, 50, 100, 100);
                
                // Request the next frame
                requestAnimationFrame(renderFrame);
            }
            
            // Start rendering
            renderFrame();
        });
        
        std::cout << "Renderer initialized with canvas!" << std::endl;
    }
}