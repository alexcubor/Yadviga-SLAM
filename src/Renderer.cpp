#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Renderer.h"

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeRenderer() {
        EM_ASM_({
            // Get global variables
            const video = window.slamVideo;
            const canvas = window.canvas;
            const ctx = canvas.getContext("2d");
            
            // Function to render the video frame on the canvas
            function renderFrame() {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    // Clear the canvas
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw the video frame
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Draw the overlay directly on the canvas
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.fillRect(200, 200, 22, 22);
                }
                
                // Request the next frame
                requestAnimationFrame(renderFrame);
            }
            
            // Start rendering
            renderFrame();
        });
        
        std::cout << "Renderer initialized with canvas!" << std::endl;
    }
}