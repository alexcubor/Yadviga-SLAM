#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Initialize.h"
#include "../include/Renderer.h"

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeSLAM(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Initializing SLAM with canvas ID: " << id << std::endl;
        
        // Initialize the video stream directly
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
                
                // Store the stream in a global variable for the renderer to use
                window.slamVideoStream = stream;
                
                // Initialize renderer after camera is ready
                Module.ccall('initializeRenderer', 'void', ['string'], [canvasId]);
                
                // Signal that the camera is ready
                window.dispatchEvent(new Event('slamCameraReady'));
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
            });
        }, canvasId);
        
        std::cout << "SLAM system initialized with canvas!" << std::endl;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void stopSLAM(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Stopping SLAM with canvas ID: " << id << std::endl;
        
        // Stop the video stream directly
        EM_ASM_({
            // Stop the video stream if it exists
            if (window.slamVideoStream) {
                window.slamVideoStream.getTracks().forEach(track => track.stop());
                window.slamVideoStream = null;
            }
        }, canvasId);
        
        std::cout << "SLAM system stopped!" << std::endl;
    }
}