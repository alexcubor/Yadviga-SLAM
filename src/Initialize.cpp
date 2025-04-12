#include <emscripten.h>
#include <iostream>
#include <string>

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeSLAM(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Initializing SLAM with canvas ID: " << id << std::endl;
        
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            console.log('Looking for canvas with ID:', canvasId);
            
            // Get canvas by the provided ID
            const canvas = document.getElementById(canvasId);
            console.log('Canvas element:', canvas);
            
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
            
            // Now we have access to canvas and its context
            // We can perform any operations with canvas
            
            // For example, get dimensions
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            
            // Create video element
            const video = document.createElement('video');
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            
            // Request camera access
            console.log('Requesting camera access...');
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera
                    width: { ideal: canvas.width },
                    height: { ideal: canvas.height }
                }
            })
            .then(stream => {
                console.log('Camera access granted');
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
                    console.log('Video metadata loaded');
                    drawFrame();
                });
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
            });
        }, canvasId);
        
        std::cout << "SLAM system initialized with canvas!" << std::endl;
    }
}