class CameraManager {
    constructor() {
        this.video = null;
        this.currentStream = null;
        this.onCameraChange = null;
        this.lastSelectedCameraId = localStorage.getItem('slam_camera_id');
    }

    async init() {
        this.createUI();
        
        // First request camera access
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            // After getting access, update camera list
            await this.updateCameraList();
        } catch (err) {
            console.error('Error getting camera access:', err);
        }
        
        this.setupAspectRatioHandling();
    }

    setupAspectRatioHandling() {
        // Create container for video
        if (!YAGA.video) return;  // Check if video exists
        
        const container = YAGA.video.parentElement;
        if (!container) return;

        // Container styles
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        // Video styles
        YAGA.video.style.position = 'absolute';
        YAGA.video.style.top = '50%';
        YAGA.video.style.left = '50%';
        YAGA.video.style.transform = 'translate(-50%, -50%)';
        YAGA.video.style.minWidth = '100%';
        YAGA.video.style.minHeight = '100%';
        YAGA.video.style.width = 'auto';
        YAGA.video.style.height = 'auto';

        // Function to update video size
        const updateVideoSize = () => {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const videoAspect = YAGA.video.videoWidth / YAGA.video.videoHeight;
            const containerAspect = containerWidth / containerHeight;

            // Determine video orientation
            const isVideoPortrait = videoAspect < 1;
            const isContainerPortrait = containerAspect < 1;

            if (isVideoPortrait) {
                // For portrait video
                if (isContainerPortrait) {
                    // Container is also portrait - align by height
                    YAGA.video.style.width = 'auto';
                    YAGA.video.style.height = '100%';
                } else {
                    // Container is landscape - align by width
                    YAGA.video.style.width = '100%';
                    YAGA.video.style.height = 'auto';
                }
            } else {
                // For landscape video
                if (isContainerPortrait) {
                    // Container is portrait - align by width
                    YAGA.video.style.width = '100%';
                    YAGA.video.style.height = 'auto';
                } else {
                    // Container is landscape - align by height
                    YAGA.video.style.width = 'auto';
                    YAGA.video.style.height = '100%';
                }
            }
        };

        // Update sizes when video size changes
        YAGA.video.addEventListener('loadedmetadata', updateVideoSize);
        window.addEventListener('resize', updateVideoSize);
    }

    createUI() {
        const cameraUI = document.createElement('div');
        cameraUI.style.minWidth = '30rem';
        cameraUI.style.maxWidth = '40rem';
        
        // Create camera selection row
        const cameraSelect = document.createElement('select');
        cameraSelect.style.width = '100%';
        cameraSelect.style.padding = '0.5rem';
        cameraSelect.style.backgroundColor = 'rgba(255,255,255,0.1)';
        cameraSelect.style.color = 'white';
        cameraSelect.style.border = '1px solid rgba(255,255,255,0.3)';
        cameraSelect.style.fontSize = '1rem';
        cameraSelect.style.borderRadius = '0.375rem';
        cameraSelect.style.marginBottom = '0.5rem';
        
        // Create dimensions display row
        const dimensionsDiv = document.createElement('div');
        dimensionsDiv.style.display = 'flex';
        dimensionsDiv.style.gap = '1rem';
        
        // Create blocks for each type of information
        const cameraInfoBlock = document.createElement('div');
        cameraInfoBlock.style.flex = '1';
        cameraInfoBlock.style.display = 'flex';
        cameraInfoBlock.style.flexDirection = 'column';
        cameraInfoBlock.style.boxSizing = 'border-box';
        
        const fpsBlock = document.createElement('div');
        fpsBlock.style.flex = '1';
        fpsBlock.style.display = 'flex';
        fpsBlock.style.flexDirection = 'column';
        fpsBlock.style.boxSizing = 'border-box';
        
        // Function to update dimensions
        const updateDimensions = () => {
            const canvas = document.getElementById('xr-canvas');
            if (canvas && YAGA.video) {
                const videoTrack = YAGA.video.srcObject?.getVideoTracks()[0];
                const settings = videoTrack?.getSettings();
                const facingMode = settings?.facingMode || 'unknown';
                cameraInfoBlock.innerHTML = `
                    Camera: ${facingMode}<br>
                    Video: ${YAGA.video.videoWidth}x${YAGA.video.videoHeight}<br>
                    Canvas: ${canvas.width}x${canvas.height}<br>
                    DPI: ${window.devicePixelRatio}`;
                
                fpsBlock.innerHTML = `
                    Page FPS: ${pageFPS}<br>
                    Camera FPS (settings): ${cameraFpsSettings}<br>
                    Camera FPS (real): ${cameraFPS}`;
            }
        };
        
        // Update dimensions periodically
        setInterval(updateDimensions, 1000);
        
        cameraSelect.onchange = () => {
            const deviceId = cameraSelect.value;
            if (deviceId) {
                localStorage.setItem('slam_camera_id', deviceId);
                this.switchCamera(deviceId);
            }
        };
        
        // Add blocks to dimensions row
        dimensionsDiv.appendChild(cameraInfoBlock);
        dimensionsDiv.appendChild(fpsBlock);
        
        // FPS logic
        let lastFrameTime = performance.now();
        let frameCount = 0;
        let pageFPS = 0;
        let cameraFPS = 0;
        let cameraFpsSettings = 'N/A';

        function updatePageFPS() {
            const now = performance.now();
            frameCount++;
            if (now - lastFrameTime >= 1000) {
                pageFPS = Math.round(frameCount * 1000 / (now - lastFrameTime));
                updateDimensions();
                frameCount = 0;
                lastFrameTime = now;
            }
            requestAnimationFrame(updatePageFPS);
        }

        let lastCameraFrameTime = null;
        let cameraFrameCount = 0;

        function updateCameraFPS() {
            if (!YAGA.video) return;
            if (YAGA.video.requestVideoFrameCallback) {
                YAGA.video.requestVideoFrameCallback(function cb(now, metadata) {
                    cameraFrameCount++;
                    if (!lastCameraFrameTime) lastCameraFrameTime = now;
                    if (now - lastCameraFrameTime >= 1000) {
                        cameraFPS = Math.round(cameraFrameCount * 1000 / (now - lastCameraFrameTime));
                        updateDimensions();
                        cameraFrameCount = 0;
                        lastCameraFrameTime = now;
                    }
                    YAGA.video.requestVideoFrameCallback(cb);
                });
            } else {
                YAGA.video.addEventListener('timeupdate', () => {
                    cameraFrameCount++;
                });
                setInterval(() => {
                    cameraFPS = cameraFrameCount;
                    updateDimensions();
                    cameraFrameCount = 0;
                }, 1000);
            }
        }

        function updateCameraFpsSettings() {
            if (YAGA.video && YAGA.video.srcObject) {
                const videoTrack = YAGA.video.srcObject.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    cameraFpsSettings = settings.frameRate || 'N/A';
                    updateDimensions();
                }
            }
        }

        // Add elements to UI
        cameraUI.appendChild(cameraSelect);
        cameraUI.appendChild(dimensionsDiv);
        
        // Add to test container instead of creating separate UI container
        window.testContainer.addComponent('camera-manager', {
            element: cameraUI
        });
        
        this.cameraSelect = cameraSelect;
        this.dimensionsDiv = dimensionsDiv;
        this.cameraInfoBlock = cameraInfoBlock;

        updatePageFPS();
        if (YAGA.video && (YAGA.video.readyState >= 2)) {
            updateCameraFPS();
            updateCameraFpsSettings();
        } else if (YAGA.video) {
            YAGA.video.addEventListener('loadeddata', () => {
                updateCameraFPS();
                updateCameraFpsSettings();
            }, { once: true });
        }
    }

    async updateCameraList() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            // Clear current options
            this.cameraSelect.innerHTML = '';
            
            // Add each camera as an option
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || 'Camera ' + device.deviceId;
                this.cameraSelect.appendChild(option);
            });

            // First check if there's already a camera set in YAGA
            if (YAGA.video && YAGA.video.srcObject) {
                const currentTrack = YAGA.video.srcObject.getVideoTracks()[0];
                if (currentTrack) {
                    const currentDeviceId = currentTrack.getSettings().deviceId;
                    if (currentDeviceId) {
                        this.cameraSelect.value = currentDeviceId;
                        // Initialize the camera with current settings
                        await this.switchCamera(currentDeviceId);
                        return; // Keep using current camera
                    }
                }
            }

            // If no current camera, try to use last selected
            if (this.lastSelectedCameraId) {
                const lastCamera = videoDevices.find(device => device.deviceId === this.lastSelectedCameraId);
                if (lastCamera) {
                    this.cameraSelect.value = this.lastSelectedCameraId;
                    await this.switchCamera(this.lastSelectedCameraId);
                    return;
                }
            }

            // If no last selected camera, try to find back camera
            const backCamera = videoDevices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear')
            );
            
            if (backCamera) {
                this.cameraSelect.value = backCamera.deviceId;
                await this.switchCamera(backCamera.deviceId);
            } else if (videoDevices.length > 0) {
                // If no back camera found, use the first available camera
                this.cameraSelect.value = videoDevices[0].deviceId;
                await this.switchCamera(videoDevices[0].deviceId);
            }
        } catch (err) {
            console.error('Error getting camera list:', err);
        }
    }

    async switchCamera(deviceId) {
        if (!deviceId) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: {exact: deviceId},
                    width: { ideal: window.innerHeight },
                    height: { ideal: window.innerWidth }
                }
            });

            // Stop current stream
            if (this.currentStream) {
                this.currentStream.getTracks().forEach(track => track.stop());
            }

            // Set new stream
            this.currentStream = stream;
            if (YAGA.video) {
                YAGA.video.srcObject = stream;
                await YAGA.video.play();
            }

            // Get camera settings
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();

            // Update tracking interval based on camera FPS
            const interval = 1000.0 / settings.frameRate;
            Module._setTrackingInterval(interval);

            // Notify about camera change
            if (this.onCameraChange) {
                this.onCameraChange(settings);
            }
        } catch (err) {
            console.error('Error switching camera:', err);
        }
    }
}

// Wait for YAGA creation through MutationObserver
const observer = new MutationObserver((mutations) => {
    if (window.YAGA) {
        observer.disconnect();
        if (window.testContainer) {
        console.log('🧪 Enable test-camera.js');
        const cameraManager = new CameraManager();
        cameraManager.init();
        } else {
            console.log('🧪 Enable test-camera.js ❌ (Please connect dev-desktop.js first)');
        }
    }
});

observer.observe(document, {
    childList: true,
    subtree: true
});


