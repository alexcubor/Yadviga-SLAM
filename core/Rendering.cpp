#include <emscripten.h>
#include <opencv2/opencv.hpp>
#include <mutex>
#include <memory>
#include <iostream>
#include "logo.svg.h"

// Global variables for renderer
EMSCRIPTEN_KEEPALIVE bool frameReady = false;  // Definition with export
EMSCRIPTEN_KEEPALIVE std::mutex frameMutex;    // Mutex for frameReady
EMSCRIPTEN_KEEPALIVE uint8_t* frameBuffer = nullptr;  // Pointer to frame buffer
EMSCRIPTEN_KEEPALIVE size_t frameBufferSize = 0;  // Frame buffer size
EMSCRIPTEN_KEEPALIVE int frameWidth = 0;  // Frame width
EMSCRIPTEN_KEEPALIVE int frameHeight = 0;  // Frame height
EMSCRIPTEN_KEEPALIVE cv::Mat cameraMatrix = cv::Mat::eye(3, 3, CV_32F);

// Declare external variables for tracking pointsё
extern int trackingPointsCount;

extern "C" {
    EMSCRIPTEN_KEEPALIVE void setCameraMatrix(float fx, float fy, float cx, float cy) {
        cameraMatrix.at<float>(0,0) = fx;  cameraMatrix.at<float>(0,1) = 0;    cameraMatrix.at<float>(0,2) = cx;
        cameraMatrix.at<float>(1,0) = 0;   cameraMatrix.at<float>(1,1) = fy;   cameraMatrix.at<float>(1,2) = cy;
        cameraMatrix.at<float>(2,0) = 0;   cameraMatrix.at<float>(2,1) = 0;    cameraMatrix.at<float>(2,2) = 1;
    }
}

extern "C" void setFrameReady(bool ready) {
    std::lock_guard<std::mutex> lock(frameMutex);
    frameReady = ready;
}

extern "C" bool getFrameReady() {
    std::lock_guard<std::mutex> lock(frameMutex);
    return frameReady;
}

extern "C" uint8_t* getFrameBuffer() {
    return frameBuffer;
}

extern "C" size_t getFrameBufferSize() {
    return frameBufferSize;
}

extern "C" void setFrameBuffer(uint8_t* buffer) {
    frameBuffer = buffer;
}

extern "C" void setFrameBufferSize(size_t size) {
    frameBufferSize = size;
}

extern "C" void setFrameWidth(int width) {
    frameWidth = width;
}

extern "C" void setFrameHeight(int height) {
    frameHeight = height;
}

extern "C" {
    void renderFrames() {
        EM_ASM_({
            // Check for meta tag with external renderer
            const metaTag = document.querySelector('meta[function="renderFrames"]');
            if (metaTag) {
                const scriptPath = metaTag.getAttribute('src');
                console.log('🎞️ Using external function from:', scriptPath);
                const script = document.createElement('script');
                script.src = scriptPath;
                script.onload = () => {
                    if (typeof window[metaTag.getAttribute('function')] === 'function') {
                        window[metaTag.getAttribute('function')]();
                    }
                };
                document.head.appendChild(script);
            } else {
                RENDER_FRAMES_JS;
                renderFrames();
            }
        });
    }
}

extern "C" {
    EMSCRIPTEN_KEEPALIVE void showLogo() {
        EM_ASM_({
            const mainCanvas = document.getElementById('xr-canvas');
            if (mainCanvas) {
                // Create canvas for logo
                const logoCanvas = document.createElement('canvas');
                logoCanvas.style.position = 'fixed';  // Changed to fixed
                logoCanvas.style.top = '0';
                logoCanvas.style.left = '0';
                logoCanvas.style.width = '100%';
                logoCanvas.style.height = '100%';
                logoCanvas.style.pointerEvents = 'none';
                logoCanvas.style.zIndex = '1000';
                logoCanvas.style.mixBlendMode = 'overlay';
                
                // Set size of logo canvas to match visual viewport
                logoCanvas.width = window.visualViewport.width;
                logoCanvas.height = window.visualViewport.height;
                
                // Get context and draw SVG
                const ctx = logoCanvas.getContext('2d');
                const img = new Image();
                img.onload = function() {
                    // Calculate size of logo (25% of canvas width)
                    const logoWidth = window.visualViewport.width * 0.25;
                    const logoHeight = (logoWidth * img.height) / img.width;
                    
                    // Draw logo in left bottom corner with safe area offset
                    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
                    const bottomOffset = Math.max(15, safeAreaBottom + 5); // At least 15px or safe area + 5px
                    
                    ctx.drawImage(img, 
                        15, // left offset
                        window.visualViewport.height - logoHeight - bottomOffset, // bottom offset with safe area
                        logoWidth,
                        logoHeight
                    );
                };
                
                // Convert SVG to data URL
                const svgBlob = new Blob([UTF8ToString($0)], {type: 'image/svg+xml'});
                img.src = URL.createObjectURL(svgBlob);
                
                // Add logo canvas after main canvas
                mainCanvas.parentNode.insertBefore(logoCanvas, mainCanvas.nextSibling);
                
                // Handle viewport resize
                window.visualViewport.addEventListener('resize', function() {
                    // Update canvas size
                    logoCanvas.width = window.visualViewport.width;
                    logoCanvas.height = window.visualViewport.height;
                    
                    // Redraw logo
                    const logoWidth = window.visualViewport.width * 0.25;
                    const logoHeight = (logoWidth * img.height) / img.width;
                    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
                    const bottomOffset = Math.max(15, safeAreaBottom + 5);
                    
                    ctx.clearRect(0, 0, logoCanvas.width, logoCanvas.height);
                    ctx.drawImage(img, 
                        15,
                        window.visualViewport.height - logoHeight - bottomOffset,
                        logoWidth,
                        logoHeight
                    );
                });
            }
        }, LOGO_SVG);
    }
}

extern "C" {
    EMSCRIPTEN_KEEPALIVE void stopCamera() {
        EM_ASM(
            if (typeof YAGA !== 'undefined') {
                YAGA.cameraActive = false;
            }
            if (typeof YAGA !== 'undefined' && YAGA.video && YAGA.video.srcObject) {
                var tracks = YAGA.video.srcObject.getTracks();
                for (var i = 0; i < tracks.length; ++i) tracks[i].stop();
                YAGA.video.srcObject = null;
                YAGA.video = null;
            }
        );
    }
}

