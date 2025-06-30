class DevToolRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.stream = null;
        this.recordedChunks = [];
        this.compositeUpdateInterval = null;
        this.pulseInterval = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        this.isMac = /Mac/.test(navigator.platform);
        this.useMP4 = this.isIOS || this.isSafari || this.isMac;
        // Sensor data
        this.sensorDataHistory = [];
        this.sensorStartTime = 0;
        this.handleOrientation = this.handleOrientation.bind(this);
        this.handleMotion = this.handleMotion.bind(this);
    }

    async init() {
        this.createMainUI();
        
        // Check if recording is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.recordButton.disabled = true;
            this.recordButton.style.opacity = '0.5';
            this.recordButton.style.cursor = 'not-allowed';
        }
    }

    createMainUI() {
        // Create main UI container
        this.mainUI = document.createElement('div');
        Object.assign(this.mainUI.style, {
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });

        // Determine button size based on platform
        const buttonSize = this.isIOS ? '8rem' : '5rem';
        const ringSize = this.isIOS ? '10rem' : '6rem';

        // Create outer ring (outline circle)
        this.outerRing = document.createElement('div');
        this.outerRing.style.width = ringSize;
        this.outerRing.style.height = ringSize;
        this.outerRing.style.borderRadius = '50%';
        this.outerRing.style.border = '3px solid rgba(0, 0, 0, 0.6)';
        this.outerRing.style.backgroundColor = 'transparent';
        this.outerRing.style.position = 'absolute';
        this.outerRing.style.transition = 'all 0.3s ease';

        // Simple record button (black circle)
        this.recordButton = document.createElement('button');
        this.recordButton.innerHTML = '';
        this.recordButton.style.width = buttonSize;
        this.recordButton.style.height = buttonSize;
        this.recordButton.style.borderRadius = '50%';
        this.recordButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.recordButton.style.border = 'none';
        this.recordButton.style.cursor = 'pointer';
        this.recordButton.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        this.recordButton.style.transition = 'all 0.3s ease';
        this.recordButton.style.position = 'relative';
        this.recordButton.style.zIndex = '1';
        this.recordButton.style.fontSize = '1.5rem';
        this.recordButton.onclick = () => this.toggleRecording();
        this.recordButton.onmouseover = () => {
            if (!this.isRecording) {
                this.recordButton.style.transform = 'scale(1.1)';
                this.outerRing.style.transform = 'scale(1.1)';
            }
        };
        this.recordButton.onmouseout = () => {
            if (!this.isRecording) {
                this.recordButton.style.transform = 'scale(1)';
                this.outerRing.style.transform = 'scale(1)';
            }
        };

        this.mainUI.appendChild(this.outerRing);
        this.mainUI.appendChild(this.recordButton);
        document.body.appendChild(this.mainUI);
    }

    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            // Update button appearance for recording
            this.recordButton.innerHTML = '';
            this.recordButton.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
            this.outerRing.style.opacity = '0';
            this.recordButton.style.transform = 'scale(1.2)';
            this.isRecording = true;
            
            // Start pulsing animation
            this.startPulseAnimation();
            
            // Always use combined canvas recording
            const allCanvasesStream = await this.captureAllCanvases();
            if (allCanvasesStream) {
                this.stream = allCanvasesStream;
            } else {
                throw new Error('Combined canvas capture failed');
            }

            await this.setupMediaRecorder();
            // Start sensor data collection
            this.sensorDataHistory = [];
            window.sensorDataHistory = this.sensorDataHistory;
            this.sensorStartTime = performance.now();
            // Get fps from quality settings
            const quality = this.getQualitySettings();
            this.fps = quality.frameRate || 60;
            window.fps = this.fps;
            window.sensorRecorderFPS = this.fps;
            window.sensorRecorderQuality = quality;
            window.sensorRecorderStartTime = this.sensorStartTime;
            window.sensorRecorderIsRecording = true;
            window.addEventListener('deviceorientation', this.handleOrientation);
            window.addEventListener('devicemotion', this.handleMotion);
        } catch (err) {
            // Reset button on error
            this.recordButton.innerHTML = '';
            this.recordButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            this.outerRing.style.opacity = '1';
            this.recordButton.style.transform = 'scale(1)';
            this.isRecording = false;
            this.stopPulseAnimation();
        }
    }

    async setupMediaRecorder() {
        const quality = this.getQualitySettings();
        
        let options;
        
        // For Mac, try MP4 first if supported, otherwise fallback to WebM
        if (this.useMP4 && MediaRecorder.isTypeSupported('video/mp4')) {
            options = {
                mimeType: 'video/mp4',
                videoBitsPerSecond: quality.bitrate
            };
        } else {
            // Use WebM with VP9 for Chrome/Firefox/Edge (better compression)
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                options = {
                    mimeType: 'video/webm;codecs=vp9',
                    videoBitsPerSecond: quality.bitrate
                };
            } else {
                options = {
                    mimeType: 'video/webm;codecs=vp8',
                    videoBitsPerSecond: quality.bitrate
                };
            }
        }

        this.mediaRecorder = new MediaRecorder(this.stream, options);
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.openRecordingInNewTab();
        };

        // Start recording
        this.mediaRecorder.start(1000); // Collect data every second
    }

    async stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop all tracks
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            // Stop composite canvas update if active
            if (this.compositeUpdateInterval) {
                clearInterval(this.compositeUpdateInterval);
                this.compositeUpdateInterval = null;
            }
            
            // Stop pulsing animation
            this.stopPulseAnimation();
            
            // Reset button appearance
            this.recordButton.innerHTML = '';
            this.recordButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            this.outerRing.style.opacity = '1';
            this.recordButton.style.transform = 'scale(1)';
            // Stop sensor data collection
            window.removeEventListener('deviceorientation', this.handleOrientation);
            window.removeEventListener('devicemotion', this.handleMotion);
        }
    }

    getQualitySettings() {
        // Default to medium quality
        const quality = 'medium';
        
        switch (quality) {
            case 'low':
                return {
                    width: 1280,
                    height: 720,
                    frameRate: 30,
                    bitrate: 2500000
                };
            case 'high':
                return {
                    width: 3840,
                    height: 2160,
                    frameRate: 60,
                    bitrate: 15000000
                };
            default: // medium
                return {
                    width: 1920,
                    height: 1080,
                    frameRate: 60,
                    bitrate: 8000000
                };
        }
    }

    async captureAllCanvases() {
        try {
            const canvases = this.getAllCanvases();
            if (canvases.length === 0) {
                return null;
            }

            const quality = this.getQualitySettings();
            const canvas = this.createCombinedCanvas(canvases);
            
            // Create stream from canvas with actual frame rate
            const stream = canvas.captureStream(quality.frameRate);
            
            // Add audio to stream
            return await this.addAudioToStream(stream);
        } catch (err) {
            return null;
        }
    }

    getAllCanvases() {
        return Array.from(document.querySelectorAll('canvas'));
    }

    createCombinedCanvas(canvases) {
        const compositeCanvas = document.createElement('canvas');
        const ctx = compositeCanvas.getContext('2d');
        
        // Use the actual size of the first canvas instead of fixed dimensions
        const firstCanvas = canvases[0];
        const actualWidth = firstCanvas.width || firstCanvas.clientWidth;
        const actualHeight = firstCanvas.height || firstCanvas.clientHeight;
        
        compositeCanvas.width = actualWidth;
        compositeCanvas.height = actualHeight;
        
        // Update composite canvas continuously
        this.compositeUpdateInterval = setInterval(() => {
            // Clear canvas
            ctx.clearRect(0, 0, actualWidth, actualHeight);
            
            // Draw all canvases on top of each other
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                
                try {
                    // Special handling for Three.js canvas
                    if (canvas.id === 'three-canvas' && window._threeRenderer) {
                        // Force a render to ensure content is visible
                        if (window._threeScene && window._threeCamera) {
                            window._threeRenderer.render(window._threeScene, window._threeCamera);
                        }
                        
                        // Get tracking offset if available
                        let offsetX = 0;
                        let offsetY = 0;
                        
                        // Try to get current transform from canvas style
                        const transform = canvas.style.transform;
                        if (transform) {
                            const matchX = transform.match(/translate\(([-\d.]+)px/);
                            const matchY = transform.match(/translate\([-\d.]+px,\s*([-\d.]+)px/);
                            if (matchX) offsetX = parseFloat(matchX[1]);
                            if (matchY) offsetY = parseFloat(matchY[1]);
                        }
                        
                        // Apply tracking offset when drawing
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.drawImage(canvas, offsetX, offsetY, actualWidth, actualHeight);
                    } else {
                        // Add regular canvas
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.drawImage(canvas, 0, 0, actualWidth, actualHeight);
                    }
                } catch (err) {
                    // Canvas not ready yet
                }
            }
        }, 33); // ~30fps
        
        return compositeCanvas;
    }

    async addAudioToStream(videoStream) {
        // Add audio if requested (default to true)
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            const tracks = [...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()];
            return new MediaStream(tracks);
        } catch (err) {
            // Audio not available
        }
        
        return videoStream;
    }

    startPulseAnimation() {
        let scale = 1.2;
        let growing = false;
        
        this.pulseInterval = setInterval(() => {
            if (growing) {
                scale += 0.02;
                if (scale >= 1.3) growing = false;
            } else {
                scale -= 0.02;
                if (scale <= 1.1) growing = true;
            }
            this.recordButton.style.transform = `scale(${scale})`;
        }, 50); // 20fps for smooth animation
    }

    stopPulseAnimation() {
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
        }
    }

    handleOrientation(event) {
        // Determine frameIndex by time from start of recording
        const now = performance.now();
        const elapsed = now - this.sensorStartTime;
        const fps = this.fps || 60;
        const frame = Math.round(elapsed / 1000 * fps);
        this.sensorDataHistory.push({
            type: 'deviceorientation',
            frame,
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            absolute: event.absolute
        });
    }

    handleMotion(event) {
        const now = performance.now();
        const elapsed = now - this.sensorStartTime;
        const fps = this.fps || 60;
        const frame = Math.round(elapsed / 1000 * fps);
        this.sensorDataHistory.push({
            type: 'devicemotion',
            frame,
            acceleration: event.acceleration ? {
                x: event.acceleration.x,
                y: event.acceleration.y,
                z: event.acceleration.z
            } : null,
            accelerationIncludingGravity: event.accelerationIncludingGravity ? {
                x: event.accelerationIncludingGravity.x,
                y: event.accelerationIncludingGravity.y,
                z: event.accelerationIncludingGravity.z
            } : null,
            rotationRate: event.rotationRate ? {
                alpha: event.rotationRate.alpha,
                beta: event.rotationRate.beta,
                gamma: event.rotationRate.gamma
            } : null,
            interval: event.interval
        });
    }

    async openRecordingInNewTab() {
        if (this.recordedChunks.length === 0) {
            return;
        }

        // Stop SLAM after recording
        if (typeof YAGA !== 'undefined' && YAGA.stop) {
            try {
                YAGA.stop();
            } catch (err) {
                console.warn('Failed to stop SLAM:', err);
            }
        }

        // Use the actual MIME type from MediaRecorder
        const mimeType = this.mediaRecorder.mimeType;
        
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = []; // Clear chunks

        // Create a data URL for the video
        const videoUrl = URL.createObjectURL(blob);
        
        // Prepare sensor data for transfer (raw)
        let sensors = this.sensorDataHistory && this.sensorDataHistory.length > 0 ? this.sensorDataHistory : [];
        const timelineUrl = `dev-tool-recorder.html`;
        const newTab = window.open(timelineUrl, '_blank');
        if (!newTab) {
            alert('Popup blocked! Please allow popups and try again.');
            return;
        }
        // Wait for editor to be ready, then send data via postMessage
        function sendData() {
            newTab.postMessage({ type: 'init-data', payload: { videoUrl, sensors } }, '*');
        }
        window.addEventListener('message', function handler(e) {
            if (e.source === newTab && e.data === 'ready-for-data') {
                sendData();
                window.removeEventListener('message', handler);
            }
        });
    }
}

// Initialize immediately
console.log('🎬 Enable dev-tool-recorder.js');
const devToolRecorder = new DevToolRecorder();
devToolRecorder.init(); 