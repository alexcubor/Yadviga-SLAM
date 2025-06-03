class SensorManager {
    constructor() {
        this.orientation = { alpha: 0, beta: 0, gamma: 0 };
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.rotationRate = { alpha: 0, beta: 0, gamma: 0 };
        this.precision = {
            orientation: 1,
            acceleration: 1,
            rotation: 0
        };
    }

    async init() {
        this.createUI();
        // Subscribe to updates from Sensors.cpp
        if (typeof Module !== 'undefined' && Module._updateIMU) {
            Module._updateIMU = (wx, wy, wz, ax, ay, az, timestamp) => {
                // Convert radians to degrees
                const toDeg = 180 / Math.PI;
                this.orientation = {
                    alpha: wx * toDeg,
                    beta: wy * toDeg,
                    gamma: wz * toDeg
                };
                this.acceleration = {
                    x: ax,
                    y: ay,
                    z: az
                };
                this.rotationRate = {
                    alpha: wx * toDeg,
                    beta: wy * toDeg,
                    gamma: wz * toDeg
                };
                this.updateDisplay();
            };
        }
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

        // Add title
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.justifyContent = 'space-between';
        titleContainer.style.marginBottom = '0.75rem';
        titleContainer.style.padding = '0.75rem';
        titleContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
        titleContainer.style.borderRadius = '0.375rem';

        const titleLabel = document.createElement('span');
        titleLabel.textContent = 'Internal Sensors';
        titleLabel.style.fontWeight = 'bold';
        titleContainer.appendChild(titleLabel);
        sensorUI.appendChild(titleContainer);

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

        // Immediately update display to show all blocks
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.orientationBlock && this.accelerationBlock && this.rotationBlock) {
            this.orientationBlock.innerHTML = 
                `Orientation:<br>
  α: ${this.orientation.alpha ? Math.abs(this.orientation.alpha).toFixed(this.precision.orientation) : '0.0'}°<br>
  β: ${this.orientation.beta ? Math.abs(this.orientation.beta).toFixed(this.precision.orientation) : '0.0'}°<br>
  γ: ${this.orientation.gamma ? Math.abs(this.orientation.gamma).toFixed(this.precision.orientation) : '0.0'}°`;

            this.accelerationBlock.innerHTML = 
                `Acceleration:<br>
  x: ${this.acceleration.x ? Math.abs(this.acceleration.x).toFixed(this.precision.acceleration) : '0.0'} m/s²<br>
  y: ${this.acceleration.y ? Math.abs(this.acceleration.y).toFixed(this.precision.acceleration) : '0.0'} m/s²<br>
  z: ${this.acceleration.z ? Math.abs(this.acceleration.z).toFixed(this.precision.acceleration) : '0.0'} m/s²`;

            this.rotationBlock.innerHTML = 
                `Rotation Rate:<br>
  α: ${this.rotationRate.alpha ? Math.abs(this.rotationRate.alpha).toFixed(this.precision.rotation) : '0.0'} °/s<br>
  β: ${this.rotationRate.beta ? Math.abs(this.rotationRate.beta).toFixed(this.precision.rotation) : '0.0'} °/s<br>
  γ: ${this.rotationRate.gamma ? Math.abs(this.rotationRate.gamma).toFixed(this.precision.rotation) : '0.0'} °/s`;
        }
    }
}

// Export for use in other files
window.SensorManager = SensorManager;

// Initialize SensorManager after Module is ready
(function() {
    function waitForModule() {
        if (typeof Module !== 'undefined' && Module._malloc) {
            console.log('🫆 Enable test-sensors.js');
            window.sensorManager = new SensorManager();
            window.sensorManager.init();
        } else {
            setTimeout(waitForModule, 100);
        }
    }
    waitForModule();
})();