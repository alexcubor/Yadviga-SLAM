class CameraManager {
    constructor() {
        this.video = null;
        this.currentStream = null;
        this.onCameraChange = null;
        this.lastSelectedCameraId = localStorage.getItem('slam_camera_id');
    }

    init(videoElement) {
        this.video = videoElement;
        this.createUI();
        this.updateCameraList();
        this.setupAspectRatioHandling();
    }

    setupAspectRatioHandling() {
        // Create container for video
        const container = this.video.parentElement;
        if (!container) return;

        // Container styles
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        // Video styles
        this.video.style.position = 'absolute';
        this.video.style.top = '50%';
        this.video.style.left = '50%';
        this.video.style.transform = 'translate(-50%, -50%)';
        this.video.style.minWidth = '100%';
        this.video.style.minHeight = '100%';
        this.video.style.width = 'auto';
        this.video.style.height = 'auto';

        // Function to update video size
        const updateVideoSize = () => {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const videoAspect = this.video.videoWidth / this.video.videoHeight;
            const containerAspect = containerWidth / containerHeight;

            // Determine video orientation
            const isVideoPortrait = videoAspect < 1;
            const isContainerPortrait = containerAspect < 1;

            if (isVideoPortrait) {
                // For portrait video
                if (isContainerPortrait) {
                    // Container is also portrait - align by height
                    this.video.style.width = 'auto';
                    this.video.style.height = '100%';
                } else {
                    // Container is landscape - align by width
                    this.video.style.width = '100%';
                    this.video.style.height = 'auto';
                }
            } else {
                // For landscape video
                if (isContainerPortrait) {
                    // Container is portrait - align by width
                    this.video.style.width = '100%';
                    this.video.style.height = 'auto';
                } else {
                    // Container is landscape - align by height
                    this.video.style.width = 'auto';
                    this.video.style.height = '100%';
                }
            }
        };

        // Update sizes when video size changes
        this.video.addEventListener('loadedmetadata', updateVideoSize);
        window.addEventListener('resize', updateVideoSize);
    }

    createUI() {
        const cameraUI = document.createElement('div');
        cameraUI.style.position = 'fixed';
        cameraUI.style.top = '5px';
        cameraUI.style.left = '5px';
        cameraUI.style.width = '50%';
        cameraUI.style.maxWidth = '200px';
        cameraUI.style.zIndex = '1000';
        cameraUI.style.padding = '5px';
        cameraUI.style.borderRadius = '3px';
        cameraUI.style.color = 'white';
        cameraUI.style.fontSize = '12px';
        cameraUI.style.mixBlendMode = 'overlay';
        
        const cameraSelect = document.createElement('select');
        cameraSelect.style.width = '100%';
        cameraSelect.style.padding = '3px';
        cameraSelect.style.backgroundColor = 'transparent';
        cameraSelect.style.color = 'white';
        cameraSelect.style.border = '1px solid rgba(255,255,255,0.3)';
        cameraSelect.style.borderRadius = '2px';
        cameraSelect.style.fontSize = '12px';
        cameraSelect.style.mixBlendMode = 'overlay';
        
        cameraSelect.onchange = () => {
            const deviceId = cameraSelect.value;
            if (deviceId) {
                localStorage.setItem('slam_camera_id', deviceId);
                this.switchCamera(deviceId);
            }
        };
        
        cameraUI.appendChild(cameraSelect);
        document.body.appendChild(cameraUI);
        
        this.cameraSelect = cameraSelect;
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

            // Select last used camera if available
            if (this.lastSelectedCameraId) {
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            // Stop current stream
            if (this.currentStream) {
                this.currentStream.getTracks().forEach(track => track.stop());
            }

            // Set new stream
            this.currentStream = stream;
            this.video.srcObject = stream;
            await this.video.play();

            // Get camera settings
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            console.log('📹 Camera settings:', settings);

            // Notify about camera change
            if (this.onCameraChange) {
                this.onCameraChange(settings);
            }
        } catch (err) {
            console.error('Error switching camera:', err);
        }
    }
}

// Export for use in other files
window.CameraManager = CameraManager; 