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
        // Оптимизация: хранить последние значения
        this.latestOrientation = null;
        this.latestMotion = null;
        this.sensorInterval = null;
        // SLAM data
        this.slamDataHistory = [];
        this.handleSLAMData = this.handleSLAMData.bind(this);
    }

    async init() {
        this.createMainUI();
        
        // Clean up old session data on init
        this.cleanupOldSessionData();
        
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
        this.recordButton.title = 'Record and Open Analyzer';
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
            // Оптимизация: сбрасываем последние значения
            this.latestOrientation = null;
            this.latestMotion = null;
            // Зафиксировать fps на 30
            this.fps = 30;
            window.fps = this.fps;
            // Сбрасываем счетчик кадров для синхронизации с видео (начинаем с 1)
            this.compositeFrameNumber = 0;
            // Сохраняем последний записанный frame
            // this.lastSensorFrameNumber = -1;
            // this.sensorInterval = setInterval(() => {
            //     if (!this.isRecording) return;
            //     const now = performance.now();
            //     const frame = Math.floor((now - this.sensorStartTime) / (1000 / this.fps));
            //     if (frame === this.lastSensorFrameNumber) return; // Записываем только один раз за кадр
            //     this.lastSensorFrameNumber = frame;
            //     if (this.latestOrientation) {
            //         this.sensorDataHistory.push({
            //             frame: frame,
            //             type: 'deviceorientation',
            //             alpha: this.latestOrientation.alpha,
            //             beta: this.latestOrientation.beta,
            //             gamma: this.latestOrientation.gamma,
            //             absolute: this.latestOrientation.absolute
            //         });
            //     }
            //     if (this.latestMotion) {
            //         this.sensorDataHistory.push({
            //             frame: frame,
            //             type: 'devicemotion',
            //             acceleration: this.latestMotion.acceleration ? {
            //                 x: this.latestMotion.acceleration.x,
            //                 y: this.latestMotion.acceleration.y,
            //                 z: this.latestMotion.acceleration.z
            //             } : null,
            //             rotationRate: this.latestMotion.rotationRate ? {
            //                 alpha: this.latestMotion.rotationRate.alpha,
            //                 beta: this.latestMotion.rotationRate.beta,
            //                 gamma: this.latestMotion.rotationRate.gamma
            //             } : null
            //         });
            //     }
            // }, 1000 / this.fps);
            window.addEventListener('deviceorientation', this.handleOrientation);
            window.addEventListener('devicemotion', this.handleMotion);
            
            // Start SLAM data collection
            this.slamDataHistory = [];
            window.slamDataHistory = this.slamDataHistory;
            
            // Get fps from quality settings
            const quality = this.getQualitySettings();
            window.fps = this.fps;
            window.sensorRecorderFPS = this.fps;
            window.sensorRecorderQuality = quality;
            window.sensorRecorderStartTime = this.sensorStartTime;
            window.sensorRecorderIsRecording = true;
            
            // Setup SLAM data collection
            this.setupSLAMDataCollection();
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
            // Очищаем интервал
            // if (this.sensorInterval) {
            //     clearInterval(this.sensorInterval);
            //     this.sensorInterval = null;
            // }
            
            // Stop SLAM data collection
            this.stopSLAMDataCollection();
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
            // === Синхронизированная запись сенсорных данных ===
            this.compositeFrameNumber = (this.compositeFrameNumber || 0) + 1;
            if (this.isRecording) {
                const frame = this.compositeFrameNumber;
                const entry = { frame };
                // orientation всегда присутствует
                entry.orientation = {
                    alpha: typeof this.latestOrientation?.alpha === 'number' ? Math.round(this.latestOrientation.alpha * 10) / 10 : null,
                    beta: typeof this.latestOrientation?.beta === 'number' ? Math.round(this.latestOrientation.beta * 10) / 10 : null,
                    gamma: typeof this.latestOrientation?.gamma === 'number' ? Math.round(this.latestOrientation.gamma * 10) / 10 : null,
                    absolute: typeof this.latestOrientation?.absolute === 'boolean' ? this.latestOrientation.absolute : null
                };
                // acceleration всегда присутствует
                entry.acceleration = {
                    x: typeof this.latestMotion?.acceleration?.x === 'number' ? Math.round(this.latestMotion.acceleration.x * 10) / 10 : null,
                    y: typeof this.latestMotion?.acceleration?.y === 'number' ? Math.round(this.latestMotion.acceleration.y * 10) / 10 : null,
                    z: typeof this.latestMotion?.acceleration?.z === 'number' ? Math.round(this.latestMotion.acceleration.z * 10) / 10 : null
                };
                // rotationRate всегда присутствует
                entry.rotationRate = {
                    alpha: typeof this.latestMotion?.rotationRate?.alpha === 'number' ? Math.round(this.latestMotion.rotationRate.alpha * 10) / 10 : null,
                    beta: typeof this.latestMotion?.rotationRate?.beta === 'number' ? Math.round(this.latestMotion.rotationRate.beta * 10) / 10 : null,
                    gamma: typeof this.latestMotion?.rotationRate?.gamma === 'number' ? Math.round(this.latestMotion.rotationRate.gamma * 10) / 10 : null
                };
                this.sensorDataHistory.push(entry);
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
        // Просто сохраняем последнее значение
        this.latestOrientation = event;
    }

    handleMotion(event) {
        // Просто сохраняем последнее значение
        this.latestMotion = event;
    }

    setupSLAMDataCollection() {
        // Store original findEssentialMat function
        if (typeof findEssentialMat === 'function') {
            this.originalFindEssentialMat = findEssentialMat;
            
            // Override findEssentialMat to capture data
            window.findEssentialMat = (...args) => {
                const result = this.originalFindEssentialMat.apply(this, args);
                this.handleSLAMData(args, result);
                return result;
            };
        }
        
        // Also capture data from other SLAM functions if they exist
        this.setupSLAMFunctionCapture('estimatePose');
        this.setupSLAMFunctionCapture('solvePnP');
        this.setupSLAMFunctionCapture('recoverPose');
        
        // Setup raw data collection from Tracking.cpp functions
        this.setupRawDataCollection();
    }

    setupSLAMFunctionCapture(functionName) {
        if (typeof window[functionName] === 'function') {
            this[`original${functionName}`] = window[functionName];
            
            window[functionName] = (...args) => {
                const result = this[`original${functionName}`].apply(this, args);
                this.handleSLAMData(args, result, functionName);
                return result;
            };
        }
    }

    stopSLAMDataCollection() {
        // Restore original functions
        if (this.originalFindEssentialMat) {
            window.findEssentialMat = this.originalFindEssentialMat;
        }
        
        // Restore other SLAM functions
        ['estimatePose', 'solvePnP', 'recoverPose'].forEach(funcName => {
            if (this[`original${funcName}`]) {
                window[funcName] = this[`original${funcName}`];
            }
        });
        
        // Stop raw data collection
        if (this.rawDataInterval) {
            clearInterval(this.rawDataInterval);
            this.rawDataInterval = null;
        }
    }

    setupRawDataCollection() {
        // Start collecting raw data from Tracking.cpp functions
        this.rawDataInterval = setInterval(() => {
            this.collectRawData();
        }, 100); // Collect every 100ms
    }

    collectRawData() {
        if (!this.isRecording || !window.Module) return;

        try {
            // Используем тот же счетчик кадров, что и для сенсорных данных
            const frame = this.compositeFrameNumber || 1;
            
            // Collect findEssentialMat data
            const findEssentialMatData = {
                frame: frame,
                essentialMatrix: this.getRawEssentialMatrix(),
                inlierMask: this.getRawInlierMask(),
                goodPointsCount: window.Module._getGoodPointsCount ? window.Module._getGoodPointsCount() : 0
            };
            
            // Collect raw recoverPose data (matrices and vectors as-is)
            const rawRecoverPoseData = {
                frame: frame,
                rotationMatrix: this.getRawRotationMatrix(),
                translationVector: this.getRawTranslationVector(),
                recoverPoseStatus: this.getRawRecoverPoseStatus(),
                goodPointsCount: window.Module._getGoodPointsCount ? window.Module._getGoodPointsCount() : 0
            };
            
            // Collect processed data (Euler angles, etc.)
            const processedData = {
                frame: frame,
                cameraMotion: this.getCameraMotionData(), // From getCameraMotion() function
                isMotionReady: window.Module._isMotionReady ? window.Module._isMotionReady() : false
            };
            
            // Collect optical flow data
            const opticalFlowData = {
                frame: frame,
                prevPoints: this.getOpticalFlowPrevPoints(),
                currPoints: this.getOpticalFlowCurrPoints(),
                status: this.getOpticalFlowStatus(),
                error: this.getOpticalFlowError(),
                pointsCount: window.Module._getOpticalFlowPointsCount ? window.Module._getOpticalFlowPointsCount() : 0,
                isOpticalFlowReady: window.Module._isOpticalFlowReady ? window.Module._isOpticalFlowReady() : false
            };
            
            // Only add findEssentialMat data if we have meaningful data
            if (findEssentialMatData.goodPointsCount > 0 || findEssentialMatData.essentialMatrix) {
                this.slamDataHistory.push(findEssentialMatData);
                console.log('📊 findEssentialMat data collected:', findEssentialMatData);
            }
            
            // Only add raw recoverPose data if we have meaningful data
            if (rawRecoverPoseData.goodPointsCount > 0 || rawRecoverPoseData.rotationMatrix) {
                this.slamDataHistory.push(rawRecoverPoseData);
                console.log('📊 Raw recoverPose data collected:', rawRecoverPoseData);
            }
            
            // Only add processed data if we have meaningful data
            if (processedData.isMotionReady && processedData.cameraMotion) {
                this.slamDataHistory.push(processedData);
                console.log('📊 Processed recoverPose data collected:', processedData);
            }
            
            // Only add optical flow data if we have meaningful data
            if (opticalFlowData.isOpticalFlowReady || opticalFlowData.pointsCount > 0) {
                this.slamDataHistory.push(opticalFlowData);
                console.log('📊 optical flow data collected:', opticalFlowData);
            }
        } catch (error) {
            console.warn('Failed to collect raw data:', error);
        }
    }

    getRawEssentialMatrix() {
        try {
            if (!window.Module._getRawEssentialMatrix) return null;
            
            const matrixPtr = window.Module._getRawEssentialMatrix();
            if (!matrixPtr) return null;
            
            // Essential Matrix is 3x3 = 9 values
            const matrix = [];
            for (let i = 0; i < 9; i++) {
                matrix.push(window.Module.HEAPF32[matrixPtr / 4 + i]);
            }
            
            // Free the memory
            window.Module._free(matrixPtr);
            
            return matrix;
        } catch (error) {
            console.warn('Failed to get raw essential matrix:', error);
            return null;
        }
    }

    getRawRotationMatrix() {
        try {
            if (!window.Module._getRawRotationMatrix) return null;
            
            const matrixPtr = window.Module._getRawRotationMatrix();
            if (!matrixPtr) return null;
            
            // Rotation Matrix is 3x3 = 9 values
            const matrix = [];
            for (let i = 0; i < 9; i++) {
                matrix.push(window.Module.HEAPF32[matrixPtr / 4 + i]);
            }
            
            // Free the memory
            window.Module._free(matrixPtr);
            
            return matrix;
        } catch (error) {
            console.warn('Failed to get raw rotation matrix:', error);
            return null;
        }
    }

    getRawTranslationVector() {
        try {
            if (!window.Module._getRawTranslationVector) return null;
            
            const vectorPtr = window.Module._getRawTranslationVector();
            if (!vectorPtr) return null;
            
            // Translation Vector is 3x1 = 3 values
            const vector = [];
            for (let i = 0; i < 3; i++) {
                vector.push(window.Module.HEAPF32[vectorPtr / 4 + i]);
            }
            
            // Free the memory
            window.Module._free(vectorPtr);
            
            return vector;
        } catch (error) {
            console.warn('Failed to get raw translation vector:', error);
            return null;
        }
    }

    getRawInlierMask() {
        try {
            if (!window.Module._getRawInlierMask) return null;
            
            const maskPtr = window.Module._getRawInlierMask();
            if (!maskPtr) return null;
            
            const size = window.Module._getInlierMaskSize();
            const mask = [];
            for (let i = 0; i < size; i++) {
                mask.push(window.Module.HEAPU8[maskPtr + i]);
            }
            
            // Free the memory
            window.Module._free(maskPtr);
            
            return mask;
        } catch (error) {
            console.warn('Failed to get raw inlier mask:', error);
            return null;
        }
    }

    getRawRecoverPoseStatus() {
        try {
            if (!window.Module._getRawRecoverPoseStatus) return null;
            
            const statusPtr = window.Module._getRawRecoverPoseStatus();
            if (!statusPtr) return null;
            
            const size = window.Module._getRecoverPoseStatusSize();
            const status = [];
            for (let i = 0; i < size; i++) {
                status.push(window.Module.HEAPU8[statusPtr + i]);
            }
            
            // Free the memory
            window.Module._free(statusPtr);
            
            return status;
        } catch (error) {
            console.warn('Failed to get raw recover pose status:', error);
            return null;
        }
    }

    getOpticalFlowPrevPoints() {
        try {
            if (!window.Module._getOpticalFlowPrevPoints) return null;
            
            const pointsPtr = window.Module._getOpticalFlowPrevPoints();
            if (!pointsPtr) return null;
            
            const count = window.Module._getOpticalFlowPointsCount();
            const points = [];
            for (let i = 0; i < count; i++) {
                points.push({
                    x: window.Module.HEAPF32[pointsPtr / 4 + i * 2],
                    y: window.Module.HEAPF32[pointsPtr / 4 + i * 2 + 1]
                });
            }
            
            // Free the memory
            window.Module._free(pointsPtr);
            
            return points;
        } catch (error) {
            console.warn('Failed to get optical flow previous points:', error);
            return null;
        }
    }

    getOpticalFlowCurrPoints() {
        try {
            if (!window.Module._getOpticalFlowCurrPoints) return null;
            
            const pointsPtr = window.Module._getOpticalFlowCurrPoints();
            if (!pointsPtr) return null;
            
            const count = window.Module._getOpticalFlowPointsCount();
            const points = [];
            for (let i = 0; i < count; i++) {
                points.push({
                    x: window.Module.HEAPF32[pointsPtr / 4 + i * 2],
                    y: window.Module.HEAPF32[pointsPtr / 4 + i * 2 + 1]
                });
            }
            
            // Free the memory
            window.Module._free(pointsPtr);
            
            return points;
        } catch (error) {
            console.warn('Failed to get optical flow current points:', error);
            return null;
        }
    }

    getOpticalFlowStatus() {
        try {
            if (!window.Module._getOpticalFlowStatus) return null;
            
            const statusPtr = window.Module._getOpticalFlowStatus();
            if (!statusPtr) return null;
            
            const count = window.Module._getOpticalFlowPointsCount();
            const status = [];
            for (let i = 0; i < count; i++) {
                status.push(window.Module.HEAPU8[statusPtr + i]);
            }
            
            // Free the memory
            window.Module._free(statusPtr);
            
            return status;
        } catch (error) {
            console.warn('Failed to get optical flow status:', error);
            return null;
        }
    }

    getOpticalFlowError() {
        try {
            if (!window.Module._getOpticalFlowError) return null;
            
            const errorPtr = window.Module._getOpticalFlowError();
            if (!errorPtr) return null;
            
            const count = window.Module._getOpticalFlowPointsCount();
            const error = [];
            for (let i = 0; i < count; i++) {
                error.push(window.Module.HEAPF32[errorPtr / 4 + i]);
            }
            
            // Free the memory
            window.Module._free(errorPtr);
            
            return error;
        } catch (error) {
            console.warn('Failed to get optical flow error:', error);
            return null;
        }
    }

    getCameraMotionData() {
        try {
            if (!window.Module._getCameraMotion) return null;
            
            const motionPtr = window.Module._getCameraMotion();
            if (!motionPtr) return null;
            
            // Camera motion is [rx, ry, rz, tx, ty, tz] = 6 values
            const motion = [];
            for (let i = 0; i < 6; i++) {
                motion.push(window.Module.HEAPF32[motionPtr / 4 + i]);
            }
            
            // Free the memory
            window.Module._free(motionPtr);
            
            return {
                rotation: motion.slice(0, 3),  // rx, ry, rz
                translation: motion.slice(3, 6) // tx, ty, tz
            };
        } catch (error) {
            console.warn('Failed to get camera motion data:', error);
            return null;
        }
    }

    handleSLAMData(args, result, functionName = 'findEssentialMat') {
        if (!this.isRecording) return;
        
        // Используем тот же счетчик кадров, что и для сенсорных данных
        const frame = this.compositeFrameNumber || 1;
        
        const slamData = {
            frame: frame,
            function: functionName,
            args: this.sanitizeSLAMArgs(args),
            result: this.sanitizeSLAMResult(result, functionName)
        };
        
        this.slamDataHistory.push(slamData);
        console.log(`🎯 SLAM data collected from ${functionName}:`, slamData);
    }

    sanitizeSLAMArgs(args) {
        // Convert OpenCV objects to serializable format
        return args.map(arg => {
            if (arg && typeof arg === 'object') {
                // Handle OpenCV Mat objects
                if (arg.rows !== undefined && arg.cols !== undefined) {
                    return {
                        type: 'Mat',
                        rows: arg.rows,
                        cols: arg.cols,
                        channels: arg.channels ? arg.channels() : undefined,
                        dataType: arg.type ? arg.type() : undefined
                    };
                }
                
                // Handle OpenCV Point objects
                if (arg.x !== undefined && arg.y !== undefined) {
                    return { type: 'Point', x: arg.x, y: arg.y };
                }
                
                // Handle arrays of points
                if (Array.isArray(arg) && arg.length > 0 && arg[0] && arg[0].x !== undefined) {
                    return {
                        type: 'PointArray',
                        length: arg.length,
                        points: arg.slice(0, 10).map(p => ({ x: p.x, y: p.y })) // Limit to first 10 points
                    };
                }
                
                // Handle other objects
                return {
                    type: 'Object',
                    keys: Object.keys(arg).slice(0, 10) // Limit keys
                };
            }
            
            return arg;
        });
    }

    sanitizeSLAMResult(result, functionName) {
        if (!result) return null;
        
        switch (functionName) {
            case 'findEssentialMat':
                return {
                    type: 'EssentialMat',
                    rows: result.rows,
                    cols: result.cols,
                    channels: result.channels ? result.channels() : undefined
                };
                
            case 'estimatePose':
                return {
                    type: 'PoseEstimate',
                    success: result.success || false,
                    rotation: result.rotation ? {
                        rows: result.rotation.rows,
                        cols: result.rotation.cols
                    } : null,
                    translation: result.translation ? {
                        rows: result.translation.rows,
                        cols: result.translation.cols
                    } : null
                };
                
            case 'solvePnP':
                return {
                    type: 'PnPResult',
                    success: result.success || false,
                    rotation: result.rotation ? {
                        rows: result.rotation.rows,
                        cols: result.rotation.cols
                    } : null,
                    translation: result.translation ? {
                        rows: result.translation.rows,
                        cols: result.translation.cols
                    } : null
                };
                
            case 'recoverPose':
                return {
                    type: 'PoseRecovery',
                    success: result.success || false,
                    rotation: result.rotation ? {
                        rows: result.rotation.rows,
                        cols: result.rotation.cols
                    } : null,
                    translation: result.translation ? {
                        rows: result.translation.rows,
                        cols: result.translation.cols
                    } : null
                };
                
            default:
                return {
                    type: 'Unknown',
                    hasResult: !!result
                };
        }
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
        
        // Prepare sensor and SLAM data for transfer
        let sensors = this.sensorDataHistory && this.sensorDataHistory.length > 0 ? 
            JSON.stringify(this.sensorDataHistory) : null;
        let slamData = this.slamDataHistory && this.slamDataHistory.length > 0 ? 
            JSON.stringify(this.slamDataHistory) : null;
        
        // Save to localStorage for persistence
        this.saveDataToLocalStorage(videoUrl, sensors, slamData);
        
        // Open analyzer in new tab
        const analyzerUrl = 'dev-tool-analyzer.html';
        const newWindow = window.open(analyzerUrl, '_blank');
        
        if (newWindow) {
            // Wait for the new window to be ready
            function sendData() {
                newWindow.postMessage({
                    type: 'init-data',
                    payload: {
                        videoUrl: videoUrl,
                        sensors: sensors,
                        slamData: slamData
                    }
                }, '*');
            }
            
            // Try to send data immediately, and also listen for ready signal
            sendData();
            
            window.addEventListener('message', function handler(e) {
                if (e.data === 'ready-for-data') {
                    sendData();
                    window.removeEventListener('message', handler);
                }
            });
        } else {
            console.warn('Failed to open analyzer window');
        }
    }

    saveDataToLocalStorage(videoUrl, sensors, slamData) {
        try {
            // Clean up old session data
            this.cleanupOldSessionData();
            
            // Save with yaga_track_ prefix for automatic discovery
            localStorage.setItem('yaga_track_video', videoUrl);
            localStorage.setItem('yaga_track_sensors', sensors);
            // localStorage.setItem('yaga_track_slam', slamData); // УБРАНО: не сохраняем общий массив
            
            // Separate data into different keys
            if (slamData) {
                try {
                    const parsedSlamData = JSON.parse(slamData);
                    
                    // Filter findEssentialMat data (по ключу, а не по type)
                    const findEssentialMatData = parsedSlamData.filter(d => d.essentialMatrix !== undefined);
                    if (findEssentialMatData.length > 0) {
                        localStorage.setItem('yaga_track_findEssentialMat', JSON.stringify(findEssentialMatData));
                    }
                    
                    // Filter raw recoverPose data (по ключу, а не по type)
                    const rawRecoverPoseData = parsedSlamData.filter(d => d.rotationMatrix !== undefined && d.translationVector !== undefined);
                    if (rawRecoverPoseData.length > 0) {
                        localStorage.setItem('yaga_track_recoverPose', JSON.stringify(rawRecoverPoseData));
                    }
                    
                    // Filter processed recoverPose data (по ключу, а не по type)
                    const processedRecoverPoseData = parsedSlamData.filter(d => d.cameraMotion !== undefined);
                    if (processedRecoverPoseData.length > 0) {
                        localStorage.setItem('yaga_track_recoverPose_Calculated', JSON.stringify(processedRecoverPoseData));
                    }
                    
                    // Filter other SLAM function data (по ключу, а не по type)
                    const otherSlamData = parsedSlamData.filter(d => d.function !== undefined);
                    if (otherSlamData.length > 0) {
                        localStorage.setItem('yaga_track_slam_functions', JSON.stringify(otherSlamData));
                    }
                } catch (e) {
                    console.warn('Failed to separate SLAM data:', e);
                }
            }
            
            // Log metadata for debugging
            const sensorCount = sensors ? JSON.parse(sensors).length : 0;
            const slamDataCount = slamData ? JSON.parse(slamData).length : 0;
            let findEssentialMatCount = 0;
            let recoverPoseCount = 0;
            let recoverPoseCalculatedCount = 0;
            let slamFunctionsCount = 0;
            
            if (slamData) {
                try {
                    const parsedSlamData = JSON.parse(slamData);
                    findEssentialMatCount = parsedSlamData.filter(d => d.essentialMatrix !== undefined).length;
                    recoverPoseCount = parsedSlamData.filter(d => d.rotationMatrix !== undefined && d.translationVector !== undefined).length;
                    recoverPoseCalculatedCount = parsedSlamData.filter(d => d.cameraMotion !== undefined).length;
                    slamFunctionsCount = parsedSlamData.filter(d => d.function !== undefined).length;
                } catch (e) {
                    console.warn('Failed to parse SLAM data for counting:', e);
                }
            }
            
            console.log('💾 Data saved to localStorage:', {
                sensorCount,
                slamDataCount,
                findEssentialMatCount,
                recoverPoseCount,
                recoverPoseCalculatedCount,
                slamFunctionsCount
            });
            
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
        }
    }

    cleanupOldSessionData() {
        try {
            // Remove old session data with timestamps
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('yaga_track_session_')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('🗑️ Removed old session data:', key);
            });
            
            if (keysToRemove.length > 0) {
                console.log(`🧹 Cleaned up ${keysToRemove.length} old session entries`);
            }
        } catch (error) {
            console.warn('Failed to cleanup old session data:', error);
        }
    }
}

// Initialize immediately
console.log('🎬 Enable dev-tool-analyzer.js');
const devToolRecorder = new DevToolRecorder();
devToolRecorder.init(); 