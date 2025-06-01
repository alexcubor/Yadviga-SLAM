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
}

testTracking();