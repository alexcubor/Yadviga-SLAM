// Performs keypoint detection using ORB.
// Tracks point motion between frames (optical flow, for example, Lucas-Kanade).
// Estimates camera position (Camera Pose Estimation) using PnP (Perspective-n-Point).

#include <emscripten.h>
#include <iostream>
#include <string>

// Import OpenCV.js
EM_JS(void, importOpenCV, (), {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.11.0/opencv.js';
        script.onload = () => {
            cv.onRuntimeInitialized = () => {
                console.log('OpenCV.js loaded successfully');
                resolve();
            };
        };
        script.onerror = () => {
            console.error('Failed to load OpenCV.js');
            reject();
        };
        document.head.appendChild(script);
    });
});

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeTracking(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Initializing tracking with canvas ID: " << id << std::endl;
        
        // Import OpenCV.js
        importOpenCV();
        
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            
            // Get canvas by the provided ID
            const canvas = document.getElementById(canvasId);
            
            if (!canvas) {
                console.error('Canvas not found! Available elements:', document.body.innerHTML);
                return;
            }
            
            // Get context
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context!');
                return;
            }
            
            // Create video element
            const video = document.createElement('video');
            video.setAttribute('autoplay', 'true');
            video.setAttribute('playsinline', 'true');
            
            // Request camera access
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera
                    width: { ideal: canvas.width },
                    height: { ideal: canvas.height }
                }
            })
            .then(stream => {
                video.srcObject = stream;
                
                // Function for frame rendering
                function drawFrame() {
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        // Draw video frame on canvas
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    }
                    // Request next frame
                    requestAnimationFrame(drawFrame);
                }
                
                // Start rendering when video is ready
                video.addEventListener('loadedmetadata', () => {
                    drawFrame();
                });
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
            });
        }, canvasId);
        
        std::cout << "Tracking system initialized with canvas!" << std::endl;
    }
}