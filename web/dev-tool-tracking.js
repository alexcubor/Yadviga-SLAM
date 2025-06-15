// Log when YAGA is initialized and then enable test-tracking.js
(function() {
    const observer = new MutationObserver(() => {
        if (window.YAGA) {
            observer.disconnect();
            if (window.testContainer) {
                console.log('🟢 Enable test-tracking.js');
                testTracking();
            } else {
                console.log('🟢 Enable test-tracking.js ❌ (Please connect dev-desktop.js first)');
            }
        }
    });
    
    observer.observe(document, { childList: true, subtree: true });
})();

// Use saved context from renderFrame
async function waitForGL() {
    // Try different ways to get the canvas
    const getCanvas = () => {
        // Try to get canvas from Babylon
        if (window._babylonEngine) {
            return window._babylonEngine.getRenderingCanvas();
        }
        
        // Try to get canvas from YAGA
        if (window.YAGA && window.YAGA.canvas) {
            return window.YAGA.canvas;
        }
        
        // Try to find canvas in DOM
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return canvas;
        }
        
        return null;
    };
    
    // Wait for canvas to be available
    let canvas = null;
    while (!canvas) {
        canvas = getCanvas();
        if (!canvas) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Get GL context
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 not supported');
    }
    
    return gl;
}

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

async function testTracking() {
    // Create tracking controls
    const trackingControls = document.createElement('div');
    trackingControls.style.minWidth = '15rem';

    // Add title
    const title = document.createElement('div');
    title.textContent = 'Tracking Controls';
    title.style.marginBottom = '0.5rem';
    trackingControls.appendChild(title);

    // Create toggles block
    const togglesBlock = document.createElement('div');

    // Lucas-Kanade toggle
    const lkToggleContainer = document.createElement('div');
    lkToggleContainer.style.display = 'flex';
    lkToggleContainer.style.alignItems = 'center';
    lkToggleContainer.style.justifyContent = 'space-between';
    lkToggleContainer.style.marginBottom = '0.5rem';

    const lkLabel = document.createElement('span');
    lkLabel.textContent = 'Lucas-Kanade';

    const lkSwitch = document.createElement('label');
    lkSwitch.style.position = 'relative';
    lkSwitch.style.display = 'inline-block';
    lkSwitch.style.width = '3.5rem';
    lkSwitch.style.height = '1.75rem';

    const lkInput = document.createElement('input');
    lkInput.type = 'checkbox';
    lkInput.style.opacity = '0';
    lkInput.style.width = '0';
    lkInput.style.height = '0';
    lkInput.checked = true;

    const lkSlider = document.createElement('span');
    lkSlider.style.position = 'absolute';
    lkSlider.style.cursor = 'pointer';
    lkSlider.style.top = '0';
    lkSlider.style.left = '0';
    lkSlider.style.right = '0';
    lkSlider.style.bottom = '0';
    lkSlider.style.backgroundColor = '#007AFF';
    lkSlider.style.transition = '.4s';
    lkSlider.style.borderRadius = '1.75rem';

    const lkKnob = document.createElement('span');
    lkKnob.style.position = 'absolute';
    lkKnob.style.content = '""';
    lkKnob.style.height = '1.5rem';
    lkKnob.style.width = '1.5rem';
    lkKnob.style.left = '0.125rem';
    lkKnob.style.bottom = '0.125rem';
    lkKnob.style.backgroundColor = 'white';
    lkKnob.style.transition = '.4s';
    lkKnob.style.borderRadius = '50%';
    lkKnob.style.transform = 'translateX(1.75rem)';

    lkInput.onchange = () => {
        lkSlider.style.backgroundColor = lkInput.checked ? '#007AFF' : '#ccc';
        lkKnob.style.transform = lkInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';
        if (typeof Module._setLucasKanadeEnabled === 'function') {
            Module._setLucasKanadeEnabled(lkInput.checked);
        }
    };

    lkSwitch.appendChild(lkInput);
    lkSwitch.appendChild(lkSlider);
    lkSwitch.appendChild(lkKnob);
    lkToggleContainer.appendChild(lkLabel);
    lkToggleContainer.appendChild(lkSwitch);
    togglesBlock.appendChild(lkToggleContainer);

    // IMU toggle
    const imuToggleContainer = document.createElement('div');
    imuToggleContainer.style.display = 'flex';
    imuToggleContainer.style.alignItems = 'center';
    imuToggleContainer.style.justifyContent = 'space-between';

    const imuLabel = document.createElement('span');
    imuLabel.textContent = 'IMU Prediction';
    
    const imuSwitch = document.createElement('label');
    imuSwitch.style.position = 'relative';
    imuSwitch.style.display = 'inline-block';
    imuSwitch.style.width = '3.5rem';
    imuSwitch.style.height = '1.75rem';

    const imuInput = document.createElement('input');
    imuInput.type = 'checkbox';
    imuInput.style.opacity = '0';
    imuInput.style.width = '0';
    imuInput.style.height = '0';
    imuInput.checked = true;

    const imuSlider = document.createElement('span');
    imuSlider.style.position = 'absolute';
    imuSlider.style.cursor = 'pointer';
    imuSlider.style.top = '0';
    imuSlider.style.left = '0';
    imuSlider.style.right = '0';
    imuSlider.style.bottom = '0';
    imuSlider.style.backgroundColor = '#007AFF';
    imuSlider.style.transition = '.4s';
    imuSlider.style.borderRadius = '1.75rem';

    const imuKnob = document.createElement('span');
    imuKnob.style.position = 'absolute';
    imuKnob.style.content = '""';
    imuKnob.style.height = '1.5rem';
    imuKnob.style.width = '1.5rem';
    imuKnob.style.left = '0.125rem';
    imuKnob.style.bottom = '0.125rem';
    imuKnob.style.backgroundColor = 'white';
    imuKnob.style.transition = '.4s';
    imuKnob.style.borderRadius = '50%';
    imuKnob.style.transform = 'translateX(1.75rem)';

    imuInput.onchange = () => {
        imuSlider.style.backgroundColor = imuInput.checked ? '#007AFF' : '#ccc';
        imuKnob.style.transform = imuInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';
        if (typeof Module._setIMUEnabled === 'function') {
            Module._setIMUEnabled(imuInput.checked);
        }
    };

    imuSwitch.appendChild(imuInput);
    imuSwitch.appendChild(imuSlider);
    imuSwitch.appendChild(imuKnob);
    imuToggleContainer.appendChild(imuLabel);
    imuToggleContainer.appendChild(imuSwitch);
    togglesBlock.appendChild(imuToggleContainer);

    // Tracking Points toggle
    const pointsToggleContainer = document.createElement('div');
    pointsToggleContainer.style.display = 'flex';
    pointsToggleContainer.style.alignItems = 'center';
    pointsToggleContainer.style.justifyContent = 'space-between';
    pointsToggleContainer.style.marginTop = '0.5rem';

    const pointsLabel = document.createElement('span');
    pointsLabel.textContent = 'Visible';
    
    const pointsSwitch = document.createElement('label');
    pointsSwitch.style.position = 'relative';
    pointsSwitch.style.display = 'inline-block';
    pointsSwitch.style.width = '3.5rem';
    pointsSwitch.style.height = '1.75rem';

    const pointsInput = document.createElement('input');
    pointsInput.type = 'checkbox';
    pointsInput.style.opacity = '0';
    pointsInput.style.width = '0';
    pointsInput.style.height = '0';
    // Load state from localStorage or default to true
    pointsInput.checked = localStorage.getItem('showTrackingPoints') !== 'false';

    // Initialize tracking points visibility state
    window.showTrackingPoints = pointsInput.checked;

    const pointsSlider = document.createElement('span');
    pointsSlider.style.position = 'absolute';
    pointsSlider.style.cursor = 'pointer';
    pointsSlider.style.top = '0';
    pointsSlider.style.left = '0';
    pointsSlider.style.right = '0';
    pointsSlider.style.bottom = '0';
    pointsSlider.style.backgroundColor = pointsInput.checked ? '#007AFF' : '#ccc';
    pointsSlider.style.transition = '.4s';
    pointsSlider.style.borderRadius = '1.75rem';

    const pointsKnob = document.createElement('span');
    pointsKnob.style.position = 'absolute';
    pointsKnob.style.content = '""';
    pointsKnob.style.height = '1.5rem';
    pointsKnob.style.width = '1.5rem';
    pointsKnob.style.left = '0.125rem';
    pointsKnob.style.bottom = '0.125rem';
    pointsKnob.style.backgroundColor = 'white';
    pointsKnob.style.transition = '.4s';
    pointsKnob.style.borderRadius = '50%';
    pointsKnob.style.transform = pointsInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';

    pointsInput.onchange = () => {
        pointsSlider.style.backgroundColor = pointsInput.checked ? '#007AFF' : '#ccc';
        pointsKnob.style.transform = pointsInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';
        window.showTrackingPoints = pointsInput.checked;
        // Save state to localStorage
        localStorage.setItem('showTrackingPoints', pointsInput.checked);
    };

    pointsSwitch.appendChild(pointsInput);
    pointsSwitch.appendChild(pointsSlider);
    pointsSwitch.appendChild(pointsKnob);
    pointsToggleContainer.appendChild(pointsLabel);
    pointsToggleContainer.appendChild(pointsSwitch);
    togglesBlock.appendChild(pointsToggleContainer);

    trackingControls.appendChild(togglesBlock);

    // Add component to test container
    window.testContainer.addComponent('tracking', {
        element: trackingControls
    });

    // Create canvas for points
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '999';
    document.body.appendChild(canvas);

    // Get 2D context
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match window
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // === Global variables ===
    let greenX = 0, greenY = 0; // center
    let offsets = []; // array of offsets for stable points
    let isFirstGreen = true;

    // Create function for points rendering
    const renderPoints = function() {
        try {
            // Skip rendering if points are disabled
            if (!window.showTrackingPoints) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const pointsPtr = Module._getTrackingPoints();
            const pointsCount = Module._getTrackingPointsCount();
            const pointsReady = Module._arePointsReady();
            
            if (pointsReady && pointsPtr && pointsCount > 0) {
                const points = new Float32Array(Module.HEAPF32.buffer, pointsPtr, pointsCount * 3);
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw points
                ctx.fillStyle = 'red';
                for (let i = 0; i < pointsCount; i++) {
                    const x = (points[i * 3] + 1) * canvas.width / 2;
                    const y = (-points[i * 3 + 1] + 1) * canvas.height / 2;  // Flip Y coordinate
                    const isStable = points[i * 3 + 2];
                    ctx.fillRect(x - 6, y - 6, 12, 12);  // Doubled size from 6x6 to 12x12

                    // Label for coordinates and stability with black outline
                    ctx.font = '12px monospace';
                    let status = isStable ? 'Stable' : 'Unstable';
                    let label = `#${i} (${points[i * 3].toFixed(2)}, ${points[i * 3 + 1].toFixed(2)}) S:${isStable} ${status}`;
                    // Black outline
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.strokeText(label, x + 10, y + 4);
                    // White text on top
                    ctx.fillStyle = 'white';
                    ctx.fillText(label, x + 10, y + 4);
                    ctx.fillStyle = 'red'; // return color for next point
                }

                // Calculate average of stable points
                let avgX = 0, avgY = 0, stableCount = 0;
                let stablePoints = [];
                for (let i = 0; i < pointsCount; i++) {
                    const isStable = points[i * 3 + 2];
                    if (isStable) {
                        stablePoints.push({x: points[i * 3], y: points[i * 3 + 1]});
                        avgX += points[i * 3];
                        avgY += points[i * 3 + 1];
                        stableCount++;
                    }
                }

                if (stableCount > 0) {
                    avgX /= stableCount;
                    avgY /= stableCount;

                    if (isFirstGreen) {
                        greenX = 0;
                        greenY = 0;
                        // Save offsets for each stable point
                        offsets = stablePoints.map(pt => ({dx: pt.x - greenX, dy: pt.y - greenY}));
                        isFirstGreen = false;
                    } else {
                        // If the number of stable points has changed, recalculate offsets for matching points
                        // (For simplicity: if the number matches, use the old offsets, otherwise recalculate)
                        if (stablePoints.length === offsets.length) {
                            // Normal case: save relative position
                            let sumX = 0, sumY = 0;
                            for (let i = 0; i < stablePoints.length; i++) {
                                sumX += stablePoints[i].x - offsets[i].dx;
                                sumY += stablePoints[i].y - offsets[i].dy;
                            }
                            greenX = sumX / stablePoints.length;
                            greenY = sumY / stablePoints.length;
                        } else {
                            // If the number of stable points has changed — recalculate offsets relative to the current position
                            offsets = stablePoints.map(pt => ({dx: pt.x - greenX, dy: pt.y - greenY}));
                        }
                    }

                    // Convert to screen coordinates
                    const screenX = (greenX + 1) * canvas.width / 2;
                    const screenY = (-greenY + 1) * canvas.height / 2;

                    // Draw average point in green
                    ctx.fillStyle = 'lime';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);  // Circle with radius 8
                    ctx.fill();

                    // Label under the green point
                    ctx.font = '14px monospace';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    const greenLabel = `G (${greenX.toFixed(2)}, ${greenY.toFixed(2)}) | Stable: ${stablePoints.length}`;
                    ctx.strokeText(greenLabel, screenX + 12, screenY + 20);
                    ctx.fillStyle = 'white';
                    ctx.fillText(greenLabel, screenX + 12, screenY + 20);
                    ctx.fillStyle = 'red'; // return color for next point
                }
            }
        } catch (e) {
            console.error('❌ Error rendering points:', e);
        }
    };

    // Start render loop
    function renderLoop() {
        renderPoints();
        requestAnimationFrame(renderLoop);
    }
    renderLoop();
}

// Set base font size
(function() {
    const isDesktop = /Win|Mac|Linux|X11|CrOS/.test(navigator.platform);
    document.documentElement.style.setProperty('font-size', isDesktop ? '0.6rem' : '1rem', 'important');
})();
