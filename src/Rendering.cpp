#include <emscripten.h>
#include <opencv2/opencv.hpp>
#include <thread>
#include <atomic>
#include <memory>
#include <iostream>

// Global variables for renderer
EMSCRIPTEN_KEEPALIVE std::atomic<bool> frameReady{false};  // Definition with export
EMSCRIPTEN_KEEPALIVE uint8_t* frameBuffer = nullptr;  // Pointer to frame buffer
EMSCRIPTEN_KEEPALIVE size_t frameBufferSize = 0;  // Frame buffer size
EMSCRIPTEN_KEEPALIVE int frameWidth = 0;  // Frame width
EMSCRIPTEN_KEEPALIVE int frameHeight = 0;  // Frame height
EMSCRIPTEN_KEEPALIVE cv::Mat cameraMatrix = cv::Mat::eye(3, 3, CV_32F);

// Declare external variables for tracking points
// extern std::vector<cv::Point2f> trackingPoints;
extern int trackingPointsCount;

extern "C" {
    EMSCRIPTEN_KEEPALIVE void setCameraMatrix(float fx, float fy, float cx, float cy) {
        cameraMatrix.at<float>(0,0) = fx;  cameraMatrix.at<float>(0,1) = 0;    cameraMatrix.at<float>(0,2) = cx;
        cameraMatrix.at<float>(1,0) = 0;   cameraMatrix.at<float>(1,1) = fy;   cameraMatrix.at<float>(1,2) = cy;
        cameraMatrix.at<float>(2,0) = 0;   cameraMatrix.at<float>(2,1) = 0;    cameraMatrix.at<float>(2,2) = 1;
    }
}

extern "C" void setFrameReady(bool ready) {
    frameReady.store(ready, std::memory_order_release);
}

extern "C" bool getFrameReady() {
    return frameReady.load(std::memory_order_acquire);
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
            console.log("Renderer.cpp ✅");
            // Create canvas element
            var canvas = document.createElement('canvas');
            canvas.id = 'xr-canvas';
            canvas.width = 640;
            canvas.height = 480;
            canvas.style.width = '100%';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';

            const gl = canvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: true
            });

            // Save context in global variable
            window._gl = gl;
            window.dispatchEvent(new CustomEvent('gl-ready', { detail: gl }));

            // Initialize render pipeline if it doesn't exist
            if (!window._renderPipeline) {
                window._renderPipeline = [];
            }

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
                void main() {
                    gl_FragColor = texture2D(u_image, v_texCoord);
                }
            `);
            gl.compileShader(fragmentShader);

            // Create program for video
            const videoProgram = gl.createProgram();
            gl.attachShader(videoProgram, vertexShader);
            gl.attachShader(videoProgram, fragmentShader);
            gl.linkProgram(videoProgram);
            gl.useProgram(videoProgram);

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
                1.0, 1.0,  // Bottom right
                0.0, 1.0,  // Bottom left
                1.0, 0.0,  // Top right
                0.0, 0.0   // Top left
            ]), gl.STATIC_DRAW);

            // Create texture for video
            const videoTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            // Create video element
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.width = canvas.width;
            video.height = canvas.height;
            
            // Add canvas to body
            document.body.appendChild(canvas);

            // Request access to camera
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    // Get camera matrix
                    const track = stream.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();
                    const settings = track.getSettings();
                    // Pass to C++
                    Module._setCameraMatrix(
                        settings.width,  // используем как приближение для fx
                        settings.height, // используем как приближение для fy
                        settings.width / 2,  // cx в центре
                        settings.height / 2  // cy в центре
                    );
                    
                    video.srcObject = stream;
                    video.play();
                    
                    // Function to process frame
                    function processFrame() {
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            // Save current state
                            const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
                            const previousBlendEnabled = gl.getParameter(gl.BLEND);
                            const previousBlendFunc = [
                                gl.getParameter(gl.BLEND_SRC_RGB),
                                gl.getParameter(gl.BLEND_DST_RGB)
                            ];

                            // Draw video
                            gl.useProgram(videoProgram);
                            
                            // Update texture
                            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                            
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

                            // Execute all stages of the render pipeline
                            if (window._renderPipeline && window._renderPipeline.length > 0) {
                                window._renderPipeline.forEach(stage => {
                                    if (stage && typeof stage.render === 'function') {
                                        stage.render(gl);
                                    }
                                });
                            }
                            
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

                            // Simulate heavy CPU load for ~50ms
                            // const startTime = performance.now();
                            // let sum = 0;
                            // while (performance.now() - startTime < 50) {
                            //     // Do some CPU-intensive work
                            //     for (let i = 0; i < 1000000; i++) {
                            //         sum += Math.sin(i) * Math.cos(i);
                            //     }
                            // }

                            // Notify about frame readiness
                            Module._setFrameReady(true);
                        }
                        requestAnimationFrame(processFrame);
                    }
                    
                    processFrame();
                })
                .catch(err => {
                    console.error('Error accessing camera:', err);
                });
        });
    }
}


extern "C" void testFPS() {
    EM_ASM_({
        // Create FPS counter element
        const fpsCounter = document.createElement('div');
        fpsCounter.id = 'test-fps-counter';
        fpsCounter.style.position = 'fixed';
        fpsCounter.style.top = '10px';
        fpsCounter.style.right = '10px';
        fpsCounter.style.color = 'white';
        fpsCounter.style.fontFamily = 'monospace';
        fpsCounter.style.fontSize = '16px';
        fpsCounter.style.backgroundColor = 'rgba(0,0,0,0.5)';
        fpsCounter.style.padding = '5px';
        fpsCounter.style.borderRadius = '5px';
        fpsCounter.style.zIndex = '1000';
        fpsCounter.textContent = 'FPS: 0';
        document.body.appendChild(fpsCounter);

        // Initialize FPS tracking variables
        let lastFrameTime = performance.now();
        let frameCount = 0;

        // Function to update FPS counter
        function updateFPS() {
            const now = performance.now();
            frameCount++;

            if (now - lastFrameTime >= 1000) {
                const fps = Math.round(frameCount * 1000 / (now - lastFrameTime));
                fpsCounter.textContent = 'FPS: ' + fps;
                frameCount = 0;
                lastFrameTime = now;
            }

            requestAnimationFrame(updateFPS);
        }

        // Start FPS counter
        updateFPS();
    });
}
