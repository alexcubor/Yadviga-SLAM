// Use saved context from renderFrame
async function waitForGL() {
    if (window._gl) return window._gl;

    return new Promise(resolve => {
        window.addEventListener('gl-ready', (e) => {
            resolve(e.detail);
        }, { once: true });
    });
}

async function testTracking() {
    const gl = await waitForGL();
    // Create shaders for points
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
            gl_PointSize = 8.0;  // Increase point size
        }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
        precision mediump float;
        void main() {
            // Make points round
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(center);
            if (dist > 0.5) {
                discard;
            }
            // Red points with a small glow
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0 - dist * 2.0);
        }
    `);
    gl.compileShader(fragmentShader);

    // Create program for points
    const pointProgram = gl.createProgram();
    gl.attachShader(pointProgram, vertexShader);
    gl.attachShader(pointProgram, fragmentShader);
    gl.linkProgram(pointProgram);

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
            gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

            // Enable blending for transparency
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            // Use program for points
            gl.useProgram(window._pointProgram);

            // Set attributes for points
            const pointPositionLocation = gl.getAttribLocation(window._pointProgram, 'a_position');
            gl.enableVertexAttribArray(pointPositionLocation);
            gl.vertexAttribPointer(pointPositionLocation, 2, gl.FLOAT, false, 0, 0);

            // Draw points
            gl.drawArrays(gl.POINTS, 0, pointsCount);
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
}

testTracking();