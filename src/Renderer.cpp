// Inserts 3D objects into the obtained scene.
// Renders using OpenGL or WebGPU.

#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Renderer.h"

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeRenderer(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Initializing renderer with canvas ID: " << id << std::endl;
        
        // This function will be called after tracking is initialized
        // It will get the video from the tracking system and render it on the canvas
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            
            // Get canvas by the provided ID
            const canvas = document.getElementById(canvasId);
            
            if (!canvas) {
                console.error('Canvas not found!');
                return;
            }
            
            // Get context
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context!');
                return;
            }
            
            // Check if the camera stream is ready
            if (window.slamVideoStream) {
                // Start rendering
                startRendering();
            } else {
                // Wait for the camera to be ready
                window.addEventListener('slamCameraReady', () => {
                    // Start rendering
                    startRendering();
                }, { once: true });
            }
            
            // Function to start rendering
            function startRendering() {
                // Create a hidden video element for capturing frames
                const video = document.createElement('video');
                video.setAttribute('autoplay', 'true');
                video.setAttribute('playsinline', 'true');
                video.style.display = 'none'; // Hide the video element
                video.srcObject = window.slamVideoStream;
                
                // Start the video
                video.play().catch(err => {
                    console.error('Error playing video:', err);
                });
                
                // Function to render the video frame on the canvas
                function renderFrame() {
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        // Clear the canvas
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        // Draw the video frame
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        // Draw the overlay directly on the canvas
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                        ctx.fillRect(200, 200, 5, 5);
                    }
                    
                    // Request the next frame
                    requestAnimationFrame(renderFrame);
                }
                
                // Start rendering
                renderFrame();
            }
        }, canvasId);
        
        std::cout << "Renderer initialized with canvas!" << std::endl;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void stopRenderer(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Stopping renderer with canvas ID: " << id << std::endl;
        
        // This function will be called when the renderer needs to be stopped
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            // Clear the canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }, canvasId);
        
        std::cout << "Renderer stopped!" << std::endl;
    }
}