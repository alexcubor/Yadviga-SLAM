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
        
        const cameraUI = document.createElement('div');
        cameraUI.style.position = 'fixed';
        cameraUI.style.top = '2vh';
        cameraUI.style.left = '2vw';
        cameraUI.style.width = '90vw';
        cameraUI.style.maxWidth = '25rem'; // ~400px on standard displays
        cameraUI.style.zIndex = '1000';
        cameraUI.style.padding = '0.75rem';
        cameraUI.style.borderRadius = '0.375rem';
        cameraUI.style.color = 'white';
        cameraUI.style.fontSize = '0.875rem';
        cameraUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
        
        const cameraSelect = document.createElement('select');
        cameraSelect.style.width = '100%';
        cameraSelect.style.padding = '0.5rem';
        cameraSelect.style.backgroundColor = 'rgba(255,255,255,0.1)';
        cameraSelect.style.color = 'white';
        cameraSelect.style.border = '1px solid rgba(255,255,255,0.3)';
        cameraSelect.style.borderRadius = '0.25rem';
        cameraSelect.style.fontSize = '0.875rem';
        cameraSelect.style.marginBottom = '0.5rem';
        
        // Add dimensions display
        const dimensionsDiv = document.createElement('div');
        dimensionsDiv.style.marginTop = '0.5rem';
        dimensionsDiv.style.padding = '0.5rem';
        dimensionsDiv.style.backgroundColor = 'rgba(0,0,0,0.3)';
        dimensionsDiv.style.borderRadius = '0.25rem';
        dimensionsDiv.style.fontFamily = 'monospace';
        dimensionsDiv.style.fontSize = '0.75rem';
        dimensionsDiv.style.lineHeight = '1.5';
        
        // Function to update dimensions
        const updateDimensions = () => {
            const canvas = document.getElementById('xr-canvas');
            if (canvas && YAGA.video) {
                const videoTrack = YAGA.video.srcObject?.getVideoTracks()[0];
                const settings = videoTrack?.getSettings();
                const facingMode = settings?.facingMode || 'unknown';
                
                dimensionsDiv.innerHTML = `
                    Canvas: ${canvas.width}x${canvas.height}<br>
                    Camera: ${facingMode}<br>
                    Video: ${YAGA.video.videoWidth}x${YAGA.video.videoHeight}<br>
                    Window: ${window.innerWidth}x${window.innerHeight}<br>
                    DPI: ${window.devicePixelRatio}
                `;
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
        
        cameraUI.appendChild(cameraSelect);
        cameraUI.appendChild(dimensionsDiv);
        document.body.appendChild(cameraUI);
        
        this.cameraSelect = cameraSelect;
        this.dimensionsDiv = dimensionsDiv;
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

            // Try to select back camera by default
            if (!this.lastSelectedCameraId) {
                // First try to find camera with "back" in label
                const backCamera = videoDevices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear')
                );
                
                if (backCamera) {
                    this.cameraSelect.value = backCamera.deviceId;
                    this.switchCamera(backCamera.deviceId);
                } else if (videoDevices.length > 0) {
                    // If no back camera found, use the first available camera
                    this.cameraSelect.value = videoDevices[0].deviceId;
                    this.switchCamera(videoDevices[0].deviceId);
                }
            } else {
                // Use last selected camera if available
                const lastCamera = videoDevices.find(device => device.deviceId === this.lastSelectedCameraId);
                if (lastCamera) {
                    this.cameraSelect.value = this.lastSelectedCameraId;
                    this.switchCamera(this.lastSelectedCameraId);
                }
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
            YAGA.video.srcObject = stream;
            await YAGA.video.play();

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


