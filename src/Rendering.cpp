#include <emscripten.h>
#include <opencv2/opencv.hpp>
#include <thread>
#include <atomic>
#include <memory>
#include <iostream>
#include "logo.svg.h"

// Global variables for renderer
EMSCRIPTEN_KEEPALIVE std::atomic<bool> frameReady{false};  // Definition with export
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
            console.log("🎞️ Renderer ✅ GPU");
            // Create canvas element
            var canvas = document.createElement('canvas');
            canvas.id = 'xr-canvas';
            
            // Make canvas fullscreen
            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                canvas.style.width = '100vw';
                canvas.style.height = '100vh';
            }
            
            // Initial resize
            resizeCanvas();
            
            // Handle window resize
            window.addEventListener('resize', resizeCanvas);
            
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
                uniform vec2 u_resolution;
                uniform vec2 u_videoResolution;
                void main() {
                    // Calculate aspect ratios
                    float videoAspect = u_videoResolution.x / u_videoResolution.y;
                    float screenAspect = u_resolution.x / u_resolution.y;
                    
                    // Calculate scaling factors
                    float scaleX = 1.0;
                    float scaleY = 1.0;
                    
                    if (videoAspect > screenAspect) {
                        // Video is wider than screen
                        scaleX = screenAspect / videoAspect;
                    } else {
                        // Video is taller than screen
                        scaleY = videoAspect / screenAspect;
                    }
                    
                    // Calculate centered coordinates
                    vec2 centeredCoord = (v_texCoord - 0.5) * vec2(scaleX, scaleY) + 0.5;
                    
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
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.width = canvas.width;
            video.height = canvas.height;
            
            // Add canvas to body
            document.body.appendChild(canvas);

            // Request access to camera
            navigator.mediaDevices.getUserMedia({ 
                video: {
                    deviceId: localStorage.getItem('slam_camera_id') ? 
                        { exact: localStorage.getItem('slam_camera_id') } : 
                        undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
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
                            
                            // Update uniforms
                            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                            gl.uniform2f(videoResolutionLocation, video.videoWidth, video.videoHeight);
                            
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
                    // Initialize camera manager if available
                    if (window.CameraManager) {
                        const cameraManager = new window.CameraManager();
                        cameraManager.init(video);
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
                })
                .catch(err => {
                    console.error('Error accessing camera:', err);
                });
        });
    }
}
extern "C" {
    EMSCRIPTEN_KEEPALIVE void initThreeScene() {
        EM_ASM_({
            // Load Three.js if not already loaded
            if (!window.THREE) {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
                script.onload = function() {
                    initScene();
                };
                document.head.appendChild(script);
            } else {
                initScene();
            }

            function initScene() {
                // Create Three.js scene if it doesn't exist
                if (!window._threeScene) {
                    // Create scene
                    window._threeScene = new THREE.Scene();
                    
                    // Get main canvas size
                    var mainCanvas = document.getElementById('xr-canvas');
                    var canvasWidth = mainCanvas.width;
                    var canvasHeight = mainCanvas.height;
                    
                    // Create camera with correct aspect ratio
                    window._threeCamera = new THREE.PerspectiveCamera(
                        75,
                        canvasWidth / canvasHeight,
                        0.1,
                        1000
                    );
                    window._threeCamera.position.set(0, 5, 5);  // Поднимаем камеру и отодвигаем назад
                    window._threeCamera.lookAt(0, 0, 0);  // Смотрим в центр сцены
                    
                    // Add grid helper
                    var gridHelper = new THREE.GridHelper(10, 10, 0x0000ff, 0x808080);
                    window._threeScene.add(gridHelper);
                    
                    // Add axes helper
                    var axesHelper = new THREE.AxesHelper(5);
                    window._threeScene.add(axesHelper);
                    
                    // Create renderer
                    var rendererOptions = Object.create(null);
                    rendererOptions.alpha = true;
                    rendererOptions.antialias = true;
                    window._threeRenderer = new THREE.WebGLRenderer(rendererOptions);
                    
                    // Set Three.js canvas size to match main canvas
                    window._threeRenderer.setSize(canvasWidth, canvasHeight);
                    window._threeRenderer.setClearColor(0x000000, 0);
                    
                    // Style the canvas to match main canvas
                    var canvas = window._threeRenderer.domElement;
                    canvas.style.position = 'fixed';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    canvas.style.width = mainCanvas.style.width;
                    canvas.style.height = mainCanvas.style.height;
                    canvas.style.zIndex = '2';
                    
                    // Add renderer to DOM
                    document.body.appendChild(canvas);
                    
                    // Add mouse navigation
                    let isDragging = false;
                    var previousMousePosition = Object.create(null);
                    previousMousePosition.x = 0;
                    previousMousePosition.y = 0;
                    
                    // Camera orbit parameters
                    var cameraDistance = 7;  // Distance from camera to center
                    var cameraPhi = Math.PI / 4;  // Angle of inclination (vertical)
                    var cameraTheta = 0;  // Angle of rotation (horizontal)
                    
                    function updateCameraPosition() {
                        // Convert spherical coordinates to Cartesian
                        window._threeCamera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
                        window._threeCamera.position.y = cameraDistance * Math.cos(cameraPhi);
                        window._threeCamera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
                        window._threeCamera.lookAt(0, 0, 0);
                    }
                    
                    // Set initial camera position
                    updateCameraPosition();
                    
                    canvas.addEventListener('mousedown', function(e) {
                        isDragging = true;
                        previousMousePosition.x = e.clientX;
                        previousMousePosition.y = e.clientY;
                    });

                    canvas.addEventListener('mousemove', function(e) {
                        if (!isDragging) return;
                        
                        var deltaMove = Object.create(null);
                        deltaMove.x = e.clientX - previousMousePosition.x;
                        deltaMove.y = e.clientY - previousMousePosition.y;

                        // Update angles (inverted rotation)
                        cameraTheta += deltaMove.x * 0.01;  // Inverted horizontal rotation
                        cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi - deltaMove.y * 0.01));  // Inverted vertical rotation

                        // Обновляем позицию камеры
                        updateCameraPosition();

                        previousMousePosition.x = e.clientX;
                        previousMousePosition.y = e.clientY;
                    });

                    canvas.addEventListener('mouseup', function() {
                        isDragging = false;
                    });
                    
                    // Handle window resize
                    window.addEventListener('resize', () => {
                        // Update main canvas size
                        var mainCanvas = document.getElementById('xr-canvas');
                        var canvasWidth = mainCanvas.width;
                        var canvasHeight = mainCanvas.height;
                        
                        // Update Three.js canvas size
                        window._threeCamera.aspect = canvasWidth / canvasHeight;
                        window._threeCamera.updateProjectionMatrix();
                        window._threeRenderer.setSize(canvasWidth, canvasHeight);
                        canvas.style.width = mainCanvas.style.width;
                        canvas.style.height = mainCanvas.style.height;
                    });

                    // Add to render pipeline
                    if (!window._renderPipeline) {
                        window._renderPipeline = [];
                    }
                    var renderStage = Object.create(null);
                    renderStage.render = function(gl) {
                        // Render Three.js scene
                        window._threeRenderer.render(window._threeScene, window._threeCamera);
                    };
                    window._renderPipeline.push(renderStage);

                    // Start animation loop
                    function animate() {
                        requestAnimationFrame(animate);
                        window._threeRenderer.render(window._threeScene, window._threeCamera);
                    }
                    animate();
                }
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
                logoCanvas.style.position = 'absolute';
                logoCanvas.style.top = '0';
                logoCanvas.style.left = '0';
                logoCanvas.style.width = mainCanvas.style.width;
                logoCanvas.style.height = mainCanvas.style.height;
                logoCanvas.style.pointerEvents = 'none';
                logoCanvas.style.zIndex = '1000';
                logoCanvas.style.mixBlendMode = 'overlay';
                
                // Set size of logo canvas
                logoCanvas.width = mainCanvas.width;
                logoCanvas.height = mainCanvas.height;
                
                // Get context and draw SVG
                const ctx = logoCanvas.getContext('2d');
                const img = new Image();
                img.onload = function() {
                    // Calculate size of logo (25% of canvas width)
                    const logoWidth = mainCanvas.width * 0.25;
                    const logoHeight = (logoWidth * img.height) / img.width;
                    
                    // Draw logo in left bottom corner
                    ctx.drawImage(img, 
                        15, // left offset
                        mainCanvas.height - logoHeight - 15, // bottom offset
                        logoWidth,
                        logoHeight
                    );
                };
                
                // Convert SVG to data URL
                const svgBlob = new Blob([UTF8ToString($0)], {type: 'image/svg+xml'});
                img.src = URL.createObjectURL(svgBlob);
                
                // Add logo canvas after main canvas
                mainCanvas.parentNode.insertBefore(logoCanvas, mainCanvas.nextSibling);
            }
        }, LOGO_SVG);
    }
}

