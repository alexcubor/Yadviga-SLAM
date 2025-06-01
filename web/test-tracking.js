// Log when YAGA is initialized and then enable test-tracking.js
(function() {
    const observer = new MutationObserver(() => {
        if (window.YAGA) {
            observer.disconnect();
            console.log('🟢 Enable test-tracking.js');
            testTracking();
        }
    });
    observer.observe(document, { childList: true, subtree: true });
})();

// Use saved context from renderFrame
async function waitForGL() {
    if (window._gl) return window._gl;

    return new Promise(resolve => {
        window.addEventListener('gl-ready', (e) => {
            resolve(e.detail);
        }, { once: true });
    });
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
    const gl = await waitForGL();
    
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
        uiContainer.style.fontSize = '1rem';
        uiContainer.style.fontFamily = 'monospace';
        document.body.appendChild(uiContainer);
    }

    // Create tracking controls
    const trackingControls = document.createElement('div');
    trackingControls.style.width = '90vw';
    trackingControls.style.maxWidth = '40rem';
    trackingControls.style.padding = '1rem';
    trackingControls.style.borderRadius = '0.5rem';
    trackingControls.style.color = 'white';
    trackingControls.style.fontSize = '1rem';
    trackingControls.style.backgroundColor = 'rgba(0,0,0,0.5)';
    trackingControls.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    trackingControls.style.position = 'relative';
    trackingControls.style.overflow = 'auto';
    trackingControls.style.transition = 'all 0.3s ease';

    // Add title
    const title = document.createElement('div');
    title.textContent = 'Tracking Controls';
    title.style.fontWeight = '500';
    title.style.marginBottom = '0.75rem';
    trackingControls.appendChild(title);

    // Create toggles block (like cacheList)
    const togglesBlock = document.createElement('div');
    togglesBlock.style.backgroundColor = 'rgba(0,0,0,0.3)';
    togglesBlock.style.borderRadius = '0.375rem';
    togglesBlock.style.padding = '0.75rem';
    togglesBlock.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    togglesBlock.style.fontSize = '1rem';
    togglesBlock.style.transition = 'all 0.3s ease';

    // Lucas-Kanade toggle
    const lkToggleContainer = document.createElement('div');
    lkToggleContainer.style.display = 'flex';
    lkToggleContainer.style.alignItems = 'center';
    lkToggleContainer.style.justifyContent = 'space-between';
    lkToggleContainer.style.marginBottom = '0.5rem';
    lkToggleContainer.style.padding = '0.5rem';
    lkToggleContainer.style.borderRadius = '0.375rem';
    lkToggleContainer.style.transition = 'background-color 0.2s';
    lkToggleContainer.onmouseover = () => lkToggleContainer.style.backgroundColor = 'rgba(255,255,255,0.1)';
    lkToggleContainer.onmouseout = () => lkToggleContainer.style.backgroundColor = 'transparent';

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
        try {
            Module._setLucasKanadeEnabled(lkInput.checked);
        } catch (e) {
            console.error('❌ Error toggling Lucas-Kanade:', e);
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
    imuToggleContainer.style.padding = '0.5rem';
    imuToggleContainer.style.borderRadius = '0.375rem';
    imuToggleContainer.style.transition = 'background-color 0.2s';
    imuToggleContainer.onmouseover = () => imuToggleContainer.style.backgroundColor = 'rgba(255,255,255,0.1)';
    imuToggleContainer.onmouseout = () => imuToggleContainer.style.backgroundColor = 'transparent';

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
        try {
            Module._setIMUEnabled(imuInput.checked);
        } catch (e) {
            console.error('❌ Error toggling IMU:', e);
        }
    };

    imuSwitch.appendChild(imuInput);
    imuSwitch.appendChild(imuSlider);
    imuSwitch.appendChild(imuKnob);
    imuToggleContainer.appendChild(imuLabel);
    imuToggleContainer.appendChild(imuSwitch);
    togglesBlock.appendChild(imuToggleContainer);

    trackingControls.appendChild(togglesBlock);

    // Create shaders for points
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
            gl_PointSize = 12.0;
        }
    `);

    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `
        precision mediump float;
        void main() {
            // Create sharp square point
            vec2 coord = gl_PointCoord - vec2(0.5);
            if (abs(coord.x) > 0.45 || abs(coord.y) > 0.45) {
                discard;
            }
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
    `);

    if (!vertexShader || !fragmentShader) {
        console.error('Failed to compile shaders');
        return;
    }

    // Create program for points
    const pointProgram = gl.createProgram();
    gl.attachShader(pointProgram, vertexShader);
    gl.attachShader(pointProgram, fragmentShader);
    gl.linkProgram(pointProgram);

    // Check for linking errors
    if (!gl.getProgramParameter(pointProgram, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(pointProgram));
        gl.deleteProgram(pointProgram);
        return;
    }

    // Save program in global variable
    window._pointProgram = pointProgram;

    // Create function for points rendering
    const renderPoints = function(gl) {
        if (!window._pointProgram) return;
        
        const pointsPtr = Module._getTrackingPoints();
        const pointsCount = Module._getTrackingPointsCount();
        const pointsReady = Module._arePointsReady();
        
        if (pointsReady && pointsPtr && pointsCount > 0) {
            const points = new Float32Array(Module.HEAPF32.buffer, pointsPtr, pointsCount * 2);
            
            // Create buffer for points
            const pointBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

            // Disable blending
            gl.disable(gl.BLEND);

            // Use program for points
            gl.useProgram(window._pointProgram);

            // Set attributes for points
            const pointPositionLocation = gl.getAttribLocation(window._pointProgram, 'a_position');
            gl.enableVertexAttribArray(pointPositionLocation);
            gl.vertexAttribPointer(pointPositionLocation, 2, gl.FLOAT, false, 0, 0);

            // Draw points
            gl.drawArrays(gl.POINTS, 0, pointsCount);

            // Cleanup
            gl.deleteBuffer(pointBuffer);
        }
    };

    // Register rendering stage in pipeline
    if (!window._renderPipeline) {
        window._renderPipeline = [];
    }
    window._renderPipeline.push({
        name: 'trackingPoints',
        render: renderPoints
    });

    uiContainer.appendChild(trackingControls);
}