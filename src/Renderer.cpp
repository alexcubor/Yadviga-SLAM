#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Renderer.h"
#include "../include/Tracking.h"

extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeRenderer() {
        EM_ASM_({
            
            // Get global variables
            const canvas = window.canvas;
            const ctx = canvas.getContext("2d");
            
            
            // ============================================================================
            // Draw tracking points on the canvas
            // ============================================================================ 

            function renderFrame() {
                if (window.trackingPoints) {
                    const point = window.trackingPoints;
                    
                    ctx.fillStyle = 'red';
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    
                    if (point.status > 0) {
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.stroke();
                    }
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