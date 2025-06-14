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
    void renderFrame() {
        EM_ASM_({
            console.log("🎞️ Renderer ✅ GPU");
            
            // Create canvas element
            var canvas = document.createElement('canvas');
            canvas.id = 'xr-canvas';
            
            // Make canvas fullscreen
            canvas.width = window.visualViewport.width;
            canvas.height = window.visualViewport.height;
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.objectFit = 'cover'; // Save proportions

            // Save canvas in YAGA.canvas
            if (typeof YAGA !== 'undefined') {
                YAGA.canvas = canvas;
            }

            const gl = canvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: true
            });

            // Set frame dimensions
            Module._setFrameWidth(canvas.width);
            Module._setFrameHeight(canvas.height);

            // Create buffer for frame data
            const frameData = new Uint8Array(canvas.width * canvas.height * 4);
            
            // Create shaders for video
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, `
                attribute vec2 a_position;
                attribute vec2 a_texCoord;
                varying vec2 v_texCoord;
                void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texCoord = a_texCoord;
                }
            `);
            gl.compileShader(vertexShader);

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, `
                precision mediump float;
                varying vec2 v_texCoord;
                uniform sampler2D u_image;
                uniform vec2 u_resolution;
                uniform vec2 u_videoResolution;
                uniform bool u_isFrontCamera;  // New uniform for camera type
                
                void main() {
                    // Calculate aspect ratios
                    float videoAspect = u_videoResolution.x / u_videoResolution.y;
                    float screenAspect = u_resolution.x / u_resolution.y;
                    
                    // Calculate scaling factors
                    float scaleX = 1.0;
                    float scaleY = 1.0;
                    
                    if (videoAspect > screenAspect) {
                        // Video is wider than screen - scale to fit height
                        scaleY = 1.0;
                        scaleX = screenAspect / videoAspect;
                    } else {
                        // Video is taller than screen - scale to fit width
                        scaleX = 1.0;
                        scaleY = 1.0;
                    }
                    
                    // Calculate centered coordinates
                    vec2 centeredCoord = (v_texCoord - 0.5) * vec2(scaleX, scaleY) + 0.5;
                    
                    // Mirror coordinates for front camera
                    if (u_isFrontCamera) {
                        centeredCoord.x = 1.0 - centeredCoord.x;
                    }
                    
                    // Check if the coordinate is within bounds
                    if (centeredCoord.x >= 0.0 && centeredCoord.x <= 1.0 &&
                        centeredCoord.y >= 0.0 && centeredCoord.y <= 1.0) {
                        gl_FragColor = texture2D(u_image, centeredCoord);
                    } else {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black bars
                    }
                }
            `);
            gl.compileShader(fragmentShader);

            // Create program for video
            const videoProgram = gl.createProgram();
            gl.attachShader(videoProgram, vertexShader);
            gl.attachShader(videoProgram, fragmentShader);
            gl.linkProgram(videoProgram);
            gl.useProgram(videoProgram);

            // Get uniform locations
            const resolutionLocation = gl.getUniformLocation(videoProgram, 'u_resolution');
            const videoResolutionLocation = gl.getUniformLocation(videoProgram, 'u_videoResolution');
            const isFrontCameraLocation = gl.getUniformLocation(videoProgram, 'u_isFrontCamera');

            // Create buffers for video
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                 1.0,  1.0,
            ]), gl.STATIC_DRAW);

            const texCoordBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                0.0, 1.0,  // Bottom left
                1.0, 1.0,  // Bottom right
                0.0, 0.0,  // Top left
                1.0, 0.0   // Top right
            ]), gl.STATIC_DRAW);

            // Create texture for video
            const videoTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            // Create video element
            YAGA.video = document.createElement('video');
            YAGA.video.autoplay = true;
            YAGA.video.playsInline = true;
            YAGA.video.width = canvas.width;
            YAGA.video.height = canvas.height;
            
            // Add canvas to body
            document.body.appendChild(canvas);

            // Request access to camera
            navigator.mediaDevices.getUserMedia({ 
                video: {
                    deviceId: localStorage.getItem('slam_camera_id') ? 
                        { exact: localStorage.getItem('slam_camera_id') } : 
                        undefined,
                    facingMode: { ideal: "environment" },  // Use back camera by default
                    width: window.innerHeight,
                    height: window.innerWidth,
                }
            })
                .then(stream => {
                    // Get camera matrix
                    const track = stream.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();
                    const settings = track.getSettings();
                    // Pass to C++
                    Module._setCameraMatrix(
                        settings.width,  // use as fx
                        settings.height, // use as fy
                        settings.width / 2,  // cx in center
                        settings.height / 2  // cy in center
                    );
                    
                    YAGA.video.srcObject = stream;
                    YAGA.video.play();
                    
                    // Flag for camera active
                    YAGA.cameraActive = true;
                    
                    // Function to process frame
                    function processFrame() {
                        if (!YAGA.cameraActive || !YAGA.video) {
                            return;
                        }
                        if (YAGA.video.readyState === YAGA.video.HAVE_ENOUGH_DATA) {
                            // Save current state
                            const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
                            const previousBlendEnabled = gl.getParameter(gl.BLEND);
                            const previousBlendFunc = [
                                gl.getParameter(gl.BLEND_SRC_RGB),
                                gl.getParameter(gl.BLEND_DST_RGB)
                            ];

                            // Draw video
                            gl.useProgram(videoProgram);
                            
                            // Update uniforms
                            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                            gl.uniform2f(videoResolutionLocation, YAGA.video.videoWidth, YAGA.video.videoHeight);
                            
                            // Check if we need to mirror the video
                            const videoTrack = YAGA.video.srcObject.getVideoTracks()[0];
                            const settings = videoTrack.getSettings();
                            // Mirror if it's front camera or if facingMode is not defined (desktop)
                            const isFrontCamera = settings.facingMode === 'user' || !settings.facingMode;
                            gl.uniform1i(isFrontCameraLocation, isFrontCamera);
                            
                            // Update texture
                            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, YAGA.video);
                            
                            // Set attributes for video
                            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                            const positionLocation = gl.getAttribLocation(videoProgram, 'a_position');
                            gl.enableVertexAttribArray(positionLocation);
                            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
                            
                            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                            const texCoordLocation = gl.getAttribLocation(videoProgram, 'a_texCoord');
                            gl.enableVertexAttribArray(texCoordLocation);
                            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
                            
                            // Draw video
                            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                            
                            // Restore previous state
                            gl.useProgram(previousProgram);
                            if (!previousBlendEnabled) {
                                gl.disable(gl.BLEND);
                            }
                            gl.blendFunc(previousBlendFunc[0], previousBlendFunc[1]);
                            
                            // Get frame data
                            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
                            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                            
                            // Allocate memory for frame buffer for Tracking in CPU
                            if (!Module._getFrameBuffer()) {
                                Module._setFrameBufferSize(pixels.length);
                                Module._setFrameBuffer(Module._malloc(pixels.length));
                            }
                            
                            // Copy data to frame buffer
                            const frameData = new Uint8Array(Module.HEAPU8.buffer, Module._getFrameBuffer(), Module._getFrameBufferSize());
                            frameData.set(pixels);
                            Module._setFrameWidth(canvas.width);
                            Module._setFrameHeight(canvas.height);
                            
                            // Notify about frame readiness
                            Module._setFrameReady(true);
                        }
                        requestAnimationFrame(processFrame);
                    }

                    // Initialize camera manager if available
                    if (window.CameraManager) {
                        const cameraManager = new window.CameraManager();
                        cameraManager.init(YAGA.video);
                        cameraManager.onCameraChange = (settings) => {
                            Module._setCameraMatrix(
                                settings.width,
                                settings.height,
                                settings.width / 2,
                                settings.height / 2
                            );
                        };
                    }
                    
                    processFrame();
                    
                    // Show logo if not disabled
                    if (YAGA.tags['logo'] !== 'false') {
                        Module._showLogo();
                    }
                })
                .catch(err => {
                    console.error('Error accessing camera:', err);
                    if (localStorage.getItem('slam_camera_id')) {
                        localStorage.removeItem('slam_camera_id');
                        console.log('Removed camera ID from localStorage. Trying again...');
                    }
                });
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

