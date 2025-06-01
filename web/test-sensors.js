class SensorManager {
    constructor() {
        this.orientation = { alpha: 0, beta: 0, gamma: 0 };
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.rotationRate = { alpha: 0, beta: 0, gamma: 0 };
        this.onSensorUpdate = null;
        this.sensorsEnabled = false;
        this.hasSensors = false;
        this.precision = {
            orientation: 1,
            acceleration: 1,
            rotation: 0
        };
    }

    async init() {
        await this.checkSensorAvailability();
        this.createUI();
        if (this.hasSensors) {
            // Enable sensors by default if available
            this.sensorsEnabled = true;
            this.toggleInput.checked = true;
            this.toggleInput.disabled = false;
            this.toggleSlider.style.backgroundColor = '#007AFF';
            this.toggleKnob.style.transform = 'translateX(1.75rem)';
            await this.setupSensors();
        } else {
            this.sensorsEnabled = false;
            this.toggleInput.checked = false;
            this.toggleInput.disabled = true;
            this.toggleSlider.style.backgroundColor = '#888';
            this.toggleKnob.style.transform = 'translateX(0)';
        }
    }

    async checkSensorAvailability() {
        // Используем только YAGA.imu
        this.hasSensors = !!(window.YAGA && window.YAGA.imu);
    }

    createUI() {
        // Get or create UI container
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
            uiContainer.style.fontSize = '1rem';
            uiContainer.style.fontFamily = 'monospace';
            document.body.appendChild(uiContainer);
        }

        const sensorUI = document.createElement('div');
        sensorUI.style.width = '90vw';
        sensorUI.style.maxWidth = '40rem';
        sensorUI.style.padding = '1rem';
        sensorUI.style.borderRadius = '0.5rem';
        sensorUI.style.color = 'white';
        sensorUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
        sensorUI.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

        // Create sensor toggle
        const toggleContainer = document.createElement('div');
        toggleContainer.style.display = 'flex';
        toggleContainer.style.alignItems = 'center';
        toggleContainer.style.justifyContent = 'space-between';
        toggleContainer.style.marginBottom = '0.75rem';
        toggleContainer.style.padding = '0.75rem';
        toggleContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
        toggleContainer.style.borderRadius = '0.375rem';

        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = 'Internal Sensors';

        const toggleSwitch = document.createElement('label');
        toggleSwitch.style.position = 'relative';
        toggleSwitch.style.display = 'inline-block';
        toggleSwitch.style.width = '3.5rem';
        toggleSwitch.style.height = '1.75rem';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.style.opacity = '0';
        toggleInput.style.width = '0';
        toggleInput.style.height = '0';
        toggleInput.checked = this.hasSensors ? this.sensorsEnabled : false;

        const toggleSlider = document.createElement('span');
        toggleSlider.style.position = 'absolute';
        toggleSlider.style.cursor = this.hasSensors ? 'pointer' : 'not-allowed';
        toggleSlider.style.top = '0';
        toggleSlider.style.left = '0';
        toggleSlider.style.right = '0';
        toggleSlider.style.bottom = '0';
        toggleSlider.style.transition = '.4s';
        toggleSlider.style.borderRadius = '1.75rem';
        toggleSlider.style.backgroundColor = this.hasSensors ? '#ccc' : '#888';

        const toggleKnob = document.createElement('span');
        toggleKnob.style.position = 'absolute';
        toggleKnob.style.content = '""';
        toggleKnob.style.height = '1.5rem';
        toggleKnob.style.width = '1.5rem';
        toggleKnob.style.left = '0.125rem';
        toggleKnob.style.bottom = '0.125rem';
        toggleKnob.style.backgroundColor = 'white';
        toggleKnob.style.transition = '.4s';
        toggleKnob.style.borderRadius = '50%';

        toggleInput.onchange = () => {
            this.sensorsEnabled = toggleInput.checked;
            toggleSlider.style.backgroundColor = this.sensorsEnabled ? '#007AFF' : '#ccc';
            toggleKnob.style.transform = this.sensorsEnabled ? 'translateX(1.75rem)' : 'translateX(0)';
            
            if (this.sensorsEnabled) {
                this.startSensors();
            } else {
                this.stopSensors();
            }
        };

        toggleSwitch.appendChild(toggleInput);
        toggleSwitch.appendChild(toggleSlider);
        toggleSwitch.appendChild(toggleKnob);
        toggleContainer.appendChild(toggleLabel);
        toggleContainer.appendChild(toggleSwitch);
        sensorUI.appendChild(toggleContainer);

        // Create sensor data display
        const sensorData = document.createElement('div');
        sensorData.style.display = 'flex';
        sensorData.style.gap = '1rem';
        sensorData.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        sensorData.style.padding = '0.75rem';
        sensorData.style.backgroundColor = 'rgba(0,0,0,0.3)';
        sensorData.style.borderRadius = '0.375rem';
        sensorData.style.lineHeight = '1.6';

        // Create blocks for each sensor type
        const orientationBlock = document.createElement('div');
        orientationBlock.style.flex = '1';
        orientationBlock.style.padding = '0.75rem';
        orientationBlock.style.backgroundColor = 'rgba(0,0,0,0.2)';
        orientationBlock.style.borderRadius = '0.375rem';
        orientationBlock.style.cursor = 'pointer';
        orientationBlock.style.userSelect = 'none';
        orientationBlock.onclick = () => {
            this.precision.orientation = this.precision.orientation === 2 ? 1 : 2;
            this.updateDisplay();
        };

        const accelerationBlock = document.createElement('div');
        accelerationBlock.style.flex = '1';
        accelerationBlock.style.padding = '0.75rem';
        accelerationBlock.style.backgroundColor = 'rgba(0,0,0,0.2)';
        accelerationBlock.style.borderRadius = '0.375rem';
        accelerationBlock.style.cursor = 'pointer';
        accelerationBlock.style.userSelect = 'none';
        accelerationBlock.onclick = () => {
            this.precision.acceleration = this.precision.acceleration === 2 ? 1 : 2;
            this.updateDisplay();
        };

        const rotationBlock = document.createElement('div');
        rotationBlock.style.flex = '1';
        rotationBlock.style.padding = '0.75rem';
        rotationBlock.style.backgroundColor = 'rgba(0,0,0,0.2)';
        rotationBlock.style.borderRadius = '0.375rem';
        rotationBlock.style.cursor = 'pointer';
        rotationBlock.style.userSelect = 'none';
        rotationBlock.onclick = () => {
            this.precision.rotation = this.precision.rotation === 0 ? 1 : 0;
            this.updateDisplay();
        };

        sensorData.appendChild(orientationBlock);
        sensorData.appendChild(accelerationBlock);
        sensorData.appendChild(rotationBlock);

        sensorUI.appendChild(sensorData);
        uiContainer.appendChild(sensorUI);

        this.sensorData = sensorData;
        this.orientationBlock = orientationBlock;
        this.accelerationBlock = accelerationBlock;
        this.rotationBlock = rotationBlock;
        this.toggleInput = toggleInput;
        this.toggleSlider = toggleSlider;
        this.toggleKnob = toggleKnob;
    }

    async setupSensors() {
        // Wait for SensorAccessManager to be available
        const waitForSensorAccessManager = () => {
            return new Promise((resolve) => {
                const check = () => {
                    if (window.SensorAccessManager) {
                        const sensorAccessManager = new SensorAccessManager();
                        sensorAccessManager.onAccessGranted = () => {
                            // Update UI state based on current enabled state
                            this.toggleInput.disabled = false;
                            this.toggleSlider.style.backgroundColor = this.sensorsEnabled ? '#007AFF' : '#ccc';
                            this.toggleKnob.style.transform = this.sensorsEnabled ? 'translateX(1.75rem)' : 'translateX(0)';
                            
                            // Start sensors if they are enabled
                            if (this.sensorsEnabled) {
                                this.startSensors();
                            }
                        };
                        sensorAccessManager.init();
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        };

        await waitForSensorAccessManager();
    }

    startSensors() {
        if (!this.hasSensors) return;

        // Handle device orientation (gyroscope)
        window.addEventListener('deviceorientation', this.handleOrientation);
        // Handle device motion (accelerometer)
        window.addEventListener('devicemotion', this.handleMotion);
    }

    stopSensors() {
        if (!this.hasSensors) return;

        window.removeEventListener('deviceorientation', this.handleOrientation);
        window.removeEventListener('devicemotion', this.handleMotion);
    }

    handleOrientation = (event) => {
        if (!this.sensorsEnabled) return;
        
        this.orientation = {
            alpha: event.alpha, // rotation around z-axis
            beta: event.beta,   // front/back tilt
            gamma: event.gamma  // left/right tilt
        };
        this.updateDisplay();
    }

    handleMotion = (event) => {
        if (!this.sensorsEnabled) return;

        this.acceleration = {
            x: event.acceleration.x,
            y: event.acceleration.y,
            z: event.acceleration.z
        };
        this.rotationRate = {
            alpha: event.rotationRate.alpha,
            beta: event.rotationRate.beta,
            gamma: event.rotationRate.gamma
        };
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.orientationBlock && this.accelerationBlock && this.rotationBlock) {
            
            this.orientationBlock.innerHTML = 
                `Orientation:<br>
  α: ${Math.abs(this.orientation.alpha).toFixed(this.precision.orientation)}°<br>
  β: ${Math.abs(this.orientation.beta).toFixed(this.precision.orientation)}°<br>
  γ: ${Math.abs(this.orientation.gamma).toFixed(this.precision.orientation)}°`;

            this.accelerationBlock.innerHTML = 
                `Acceleration:<br>
  x: ${this.acceleration.x ? Math.abs(this.acceleration.x).toFixed(this.precision.acceleration) : 'N/A'} m/s²<br>
  y: ${this.acceleration.y ? Math.abs(this.acceleration.y).toFixed(this.precision.acceleration) : 'N/A'} m/s²<br>
  z: ${this.acceleration.z ? Math.abs(this.acceleration.z).toFixed(this.precision.acceleration) : 'N/A'} m/s²`;

            this.rotationBlock.innerHTML = 
                `Rotation Rate:<br>
  α: ${this.rotationRate.alpha ? Math.abs(this.rotationRate.alpha).toFixed(this.precision.rotation) : 'N/A'} °/s<br>
  β: ${this.rotationRate.beta ? Math.abs(this.rotationRate.beta).toFixed(this.precision.rotation) : 'N/A'} °/s<br>
  γ: ${this.rotationRate.gamma ? Math.abs(this.rotationRate.gamma).toFixed(this.precision.rotation) : 'N/A'} °/s`;
        }

        if (this.onSensorUpdate) {
            this.onSensorUpdate({
                orientation: this.orientation,
                acceleration: this.acceleration,
                rotationRate: this.rotationRate,
                enabled: this.sensorsEnabled
            });
        }
    }
}

// Export for use in other files
window.SensorManager = SensorManager;

// Wrap observer in IIFE to avoid variable redeclaration
(function() {
    const observer = new MutationObserver((mutations) => {
        if (window.YAGA) {
            observer.disconnect();
            const sensorManager = new SensorManager();
            sensorManager.init();
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
})();