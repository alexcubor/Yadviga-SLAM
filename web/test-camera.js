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
        // Set root font size
        document.documentElement.style.fontSize = '16px';
        
        // Create UI container if it doesn't exist
        let uiContainer = document.getElementById('yaga-ui-container');
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'yaga-ui-container';
            uiContainer.style.position = 'fixed';
            uiContainer.style.top = '2vh';
            uiContainer.style.left = '2vw';
            uiContainer.style.zIndex = '1000';
            uiContainer.style.display = 'flex';
            uiContainer.style.flexDirection = 'column';
            uiContainer.style.gap = '1rem';
            document.body.appendChild(uiContainer);
        }
        
        const cameraUI = document.createElement('div');
        cameraUI.style.width = '90vw';
        cameraUI.style.maxWidth = '32rem';
        cameraUI.style.padding = '1rem';
        cameraUI.style.borderRadius = '0.5rem';
        cameraUI.style.color = 'white';
        cameraUI.style.fontSize = '1rem';
        cameraUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
        cameraUI.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        
        // Create camera selection row
        const cameraSelect = document.createElement('select');
        cameraSelect.style.width = '100%';
        cameraSelect.style.padding = '0.75rem';
        cameraSelect.style.backgroundColor = 'rgba(255,255,255,0.1)';
        cameraSelect.style.color = 'white';
        cameraSelect.style.border = '1px solid rgba(255,255,255,0.3)';
        cameraSelect.style.borderRadius = '0.375rem';
        cameraSelect.style.fontSize = '1rem';
        cameraSelect.style.marginBottom = '0.75rem';
        
        // Create dimensions display row
        const dimensionsDiv = document.createElement('div');
        dimensionsDiv.style.display = 'flex';
        dimensionsDiv.style.gap = '1rem';
        dimensionsDiv.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        dimensionsDiv.style.padding = '0.75rem';
        dimensionsDiv.style.backgroundColor = 'rgba(0,0,0,0.3)';
        dimensionsDiv.style.borderRadius = '0.375rem';
        dimensionsDiv.style.fontSize = '1rem';
        dimensionsDiv.style.lineHeight = '1.6';
        
        // Create blocks for each type of information
        const cameraInfoBlock = document.createElement('div');
        cameraInfoBlock.style.flex = '1';
        cameraInfoBlock.style.padding = '0.75rem';
        cameraInfoBlock.style.backgroundColor = 'rgba(0,0,0,0.2)';
        cameraInfoBlock.style.borderRadius = '0.375rem';
        
        const dpiInfoBlock = document.createElement('div');
        dpiInfoBlock.style.flex = '1';
        dpiInfoBlock.style.padding = '0.75rem';
        dpiInfoBlock.style.backgroundColor = 'rgba(0,0,0,0.2)';
        dpiInfoBlock.style.borderRadius = '0.375rem';
        
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
                    Canvas: ${canvas.width}x${canvas.height}`;
                
                dpiInfoBlock.innerHTML = `
                    Window: ${window.innerWidth}x${window.innerHeight}<br>
                    DPI: ${window.devicePixelRatio}`;
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
        dimensionsDiv.appendChild(dpiInfoBlock);
        
        // Add elements to UI
        cameraUI.appendChild(cameraSelect);
        cameraUI.appendChild(dimensionsDiv);
        uiContainer.appendChild(cameraUI);
        
        this.cameraSelect = cameraSelect;
        this.dimensionsDiv = dimensionsDiv;
        this.cameraInfoBlock = cameraInfoBlock;
        this.dpiInfoBlock = dpiInfoBlock;
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
        console.log('🧪 Enable test-camera.js');
        const cameraManager = new CameraManager();
        cameraManager.init();
    }
});

observer.observe(document, {
    childList: true,
    subtree: true
});


