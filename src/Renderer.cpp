#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Renderer.h"
#include "../include/Tracking.h"

extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeRenderer() {
        EM_ASM_({
            // ============================================================================
            // Initialize video and canvas
            // ============================================================================

            // 1. Get canvas context
            const ctx = window.canvas.getContext('2d');

            // 2. Draw tracking points
            function renderFrame() {
                if (window.trackingPoints && window.trackingPoints.length > 0) {
                    ctx.fillStyle = 'red';
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    window.trackingPoints.forEach(point => {
                        if (point.status > 0) {
                            ctx.beginPath();
                            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.stroke();
                        }
                    });
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