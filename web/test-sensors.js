class SensorManager {
    constructor() {
        this.orientation = { alpha: 0, beta: 0, gamma: 0 };
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.rotationRate = { alpha: 0, beta: 0, gamma: 0 };
        this.precision = {
            orientation: 1,
            acceleration: 1,
            rotation: 1
        };
        this.selectedValue = null;
    }

    async init() {
        this.createUI();
        
        // Handle emulator data directly
        window.addEventListener('deviceorientation', (event) => {
            if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
                this.orientation = {
                    alpha: event.alpha,
                    beta: event.beta,
                    gamma: event.gamma
                };
                this.updateDisplay();
            }
        });

        // Subscribe to updates from Sensors.cpp for real device
        if (typeof Module !== 'undefined' && Module._updateIMU) {
            Module._updateIMU = (wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz) => {
                // Convert radians to degrees
                const toDeg = 180 / Math.PI;
                
                // Skip if all values are 0 (emulator mode)
                if (wx === 0 && wy === 0 && wz === 0 && 
                    ax === 0 && ay === 0 && az === 0 && 
                    rx === 0 && ry === 0 && rz === 0) {
                    return;
                }
                
                // For real device, use smoothing
                const smoothingFactor = 0.1;
                
                // Update rotation rate values with smoothing
                this.rotationRate = {
                    alpha: this.rotationRate ? 
                        this.rotationRate.alpha * (1 - smoothingFactor) + (rx * toDeg) * smoothingFactor :
                        rx * toDeg,
                    beta: this.rotationRate ?
                        this.rotationRate.beta * (1 - smoothingFactor) + (ry * toDeg) * smoothingFactor :
                        ry * toDeg,
                    gamma: this.rotationRate ?
                        this.rotationRate.gamma * (1 - smoothingFactor) + (rz * toDeg) * smoothingFactor :
                        rz * toDeg
                };
                
                // Update orientation values with smoothing
                this.orientation = {
                    alpha: this.orientation ?
                        this.orientation.alpha * (1 - smoothingFactor) + (wx * toDeg) * smoothingFactor :
                        wx * toDeg,
                    beta: this.orientation ?
                        this.orientation.beta * (1 - smoothingFactor) + (wy * toDeg) * smoothingFactor :
                        wy * toDeg,
                    gamma: this.orientation ?
                        this.orientation.gamma * (1 - smoothingFactor) + (wz * toDeg) * smoothingFactor :
                        wz * toDeg
                };
                
                // Update acceleration values with smoothing
                this.acceleration = {
                    x: this.acceleration ?
                        this.acceleration.x * (1 - smoothingFactor) + ax * smoothingFactor :
                        ax,
                    y: this.acceleration ?
                        this.acceleration.y * (1 - smoothingFactor) + ay * smoothingFactor :
                        ay,
                    z: this.acceleration ?
                        this.acceleration.z * (1 - smoothingFactor) + az * smoothingFactor :
                        az
                };
                
                // Update the UI
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
        orientationBlock.ondblclick = (e) => this.handleDoubleClick(e, 'orientation');

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
        accelerationBlock.ondblclick = (e) => this.handleDoubleClick(e, 'acceleration');

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
        rotationBlock.ondblclick = (e) => this.handleDoubleClick(e, 'rotation');

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

    handleDoubleClick(event, type) {
        const target = event.target;

        if (target.tagName === 'BR') return;

        // Get the value from the clicked text
        const text = target.textContent;
        
        // Try to find the value in the clicked line
        const lines = text.split('\n');
        let valueLine = '';
        for (const line of lines) {
            if (line.includes('α:') || line.includes('β:') || line.includes('γ:') || 
                line.includes('x:') || line.includes('y:') || line.includes('z:')) {
                valueLine = line.trim();
                break;
            }
        }
        
        if (!valueLine) return;
        
        // Match both formats: "x: 1.23" and "α: 1.23"
        const match = valueLine.match(/([xyzαβγ]):\s*([-\d.]+)/);
        
        if (!match) return;

        const axis = match[1];
        let value;
        
        // Get the actual value based on type and axis
        if (type === 'orientation') {
            const axisMap = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma' };
            value = this.orientation[axisMap[axis]];
        } else if (type === 'acceleration') {
            value = this.acceleration[axis];
        } else if (type === 'rotation') {
            const axisMap = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma' };
            value = this.rotationRate[axisMap[axis]];
        }

        if (value === undefined) return;

        // Copy value to clipboard
        navigator.clipboard.writeText(value.toString()).then(() => {
            // Show temporary feedback
            const originalText = target.textContent;
            const originalHTML = target.innerHTML;
            target.innerHTML = '✓ Copied!';
            target.style.color = '#4CAF50';  // Green color for success
            
            // Restore original text after 1 second
            setTimeout(() => {
                target.innerHTML = originalHTML;
                target.style.color = '';
            }, 1000);
        }).catch(err => {
            console.error('Failed to copy value:', err);
        });
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

// Initialize SensorManager after YAGA is ready
const observer = new MutationObserver((mutations) => {
    if (window.YAGA) {
        observer.disconnect();
        console.log('🕹️ Enable test-sensors.js');
        window.sensorManager = new SensorManager();
        window.sensorManager.init();
    }
});

observer.observe(document, {
    childList: true,
    subtree: true
});