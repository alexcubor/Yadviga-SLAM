#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Initialize.h"
#include "../include/Renderer.h"
#include "../include/Tracking.h"

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void initializeSLAM(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Getting video for canvas ID: " << id << std::endl;
        
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            console.log('Looking for canvas with ID:', canvasId);
            
            // 1. Get canvas by the provided ID
            canvas = document.getElementById(canvasId);
            console.log('Canvas element:', canvas);
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);


            //=============================================================
            // Video Stream Initialization
            //=============================================================

            // 2. Request camera access
            console.log('Requesting camera access...');
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera
                    width: { ideal: canvas.width },
                    height: { ideal: canvas.height }
                }
            })
            .then(function(stream) {

                // 3. Create video element and attach stream
                const video = document.createElement("video");
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true; // Prevent fullscreen on iOS
                const ctx = canvas.getContext("2d");

                function drawFrame() {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(drawFrame);
                }
                drawFrame();


                // Output global variables:
                //=============================================================
                window.canvas = canvas;
                //=============================================================


                //=============================================================
                // Tracker Initialization
                //=============================================================

                Module.ccall('initializeTracker', 'void', [], []);


                //=============================================================
                // Renderer Initialization
                //=============================================================

                Module.ccall('initializeRenderer', 'void', [], []);

            })

            }, canvasId);
    }
}