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
    console.log('🟡 test-tracking.js: Waiting for GL context');
    
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
            console.log('🟡 test-tracking.js: Waiting for canvas...');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('🟡 test-tracking.js: Canvas found');
    
    // Get GL context
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 not supported');
    }
    
    console.log('🟡 test-tracking.js: GL context ready');
    return gl;
}

function compileShader(gl, type, source) {
    console.log('🟡 test-tracking.js: Compiling shader');
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    console.log('🟡 test-tracking.js: Shader compiled successfully');
    return shader;
}

async function testTracking() {
    // Create tracking controls
    const trackingControls = document.createElement('div');

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
        console.log('🔄 Lucas-Kanade toggle:', lkInput.checked);
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
        console.log('🔄 IMU toggle:', imuInput.checked);
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

    // Create function for points rendering
    const renderPoints = function() {
        try {
            const pointsPtr = Module._getTrackingPoints();
            const pointsCount = Module._getTrackingPointsCount();
            const pointsReady = Module._arePointsReady();
            
            if (pointsReady && pointsPtr && pointsCount > 0) {
                const points = new Float32Array(Module.HEAPF32.buffer, pointsPtr, pointsCount * 2);
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw points
                ctx.fillStyle = 'red';
                for (let i = 0; i < pointsCount; i++) {
                    const x = (points[i * 2] + 1) * canvas.width / 2;
                    const y = (-points[i * 2 + 1] + 1) * canvas.height / 2;  // Flip Y coordinate
                    ctx.fillRect(x - 6, y - 6, 12, 12);  // Doubled size from 6x6 to 12x12
                }

                // Calculate and draw average point
                let avgX = 0, avgY = 0;
                for (let i = 0; i < pointsCount; i++) {
                    avgX += points[i * 2];
                    avgY += points[i * 2 + 1];
                }
                avgX /= pointsCount;
                avgY /= pointsCount;

                // Convert to screen coordinates
                const screenX = (avgX + 1) * canvas.width / 2;
                const screenY = (-avgY + 1) * canvas.height / 2;

                // Draw average point in green
                ctx.fillStyle = 'lime';
                ctx.beginPath();
                ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);  // Circle with radius 8
                ctx.fill();
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
