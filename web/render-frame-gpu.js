console.log("🎞️ Renderer ✅ GPU");

// Create video element
if (!window.YAGA) {
    window.YAGA = { 
        video: null,
        init() {
            // Initialize YAGA
            console.log('YAGA initialized');
        }
    };
}

// Create canvas element
const canvas = document.createElement('canvas');
canvas.id = 'xr-canvas';

// Make canvas fullscreen
canvas.width = window.visualViewport.width;
canvas.height = window.visualViewport.height;
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.objectFit = 'cover';

// Initialize WebGL context
const gl = canvas.getContext('webgl');
if (!gl) {
    console.error('WebGL not supported');
    throw new Error('WebGL not supported');
}

// Vertex shader source
const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform float u_aspectRatio;
    varying vec2 v_texCoord;
    void main() {
        vec2 position = a_position;
        // Scale by X with aspect ratio
        position.x *= u_aspectRatio;
        gl_Position = vec4(position, 0, 1);
        v_texCoord = a_texCoord;
    }
`;

// Fragment shader source
const fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform bool u_mirror;
    varying vec2 v_texCoord;
    void main() {
        vec2 texCoord = v_texCoord;
        if (u_mirror) {
            texCoord.x = 1.0 - texCoord.x;
        }
        gl_FragColor = texture2D(u_image, texCoord);
    }
`;

// Create shaders
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Create program
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Create shaders and program
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

// Get attribute and uniform locations
const positionLocation = gl.getAttribLocation(program, 'a_position');
const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
const imageLocation = gl.getUniformLocation(program, 'u_image');
const mirrorLocation = gl.getUniformLocation(program, 'u_mirror');
const aspectRatioLocation = gl.getUniformLocation(program, 'u_aspectRatio');

// Create buffers
const positionBuffer = gl.createBuffer();
const texCoordBuffer = gl.createBuffer();

// Set up position buffer
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,  1,  // top left
     1,  1,  // top right
    -1, -1,  // bottom left
     1, -1,  // bottom right
]), gl.STATIC_DRAW);

// Set up texture coordinate buffer
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,  // top left
    1, 0,  // top right
    0, 1,  // bottom left
    1, 1,  // bottom right
]), gl.STATIC_DRAW);

// Create texture
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

YAGA.video = document.createElement('video');
YAGA.video.autoplay = true;
YAGA.video.playsInline = true;

// Add canvas to page
document.body.appendChild(canvas);

// Request camera access
navigator.mediaDevices.getUserMedia({
    video: {
        deviceId: localStorage.getItem('slam_camera_id') ? 
            { exact: localStorage.getItem('slam_camera_id') } : 
            undefined,
        facingMode: { ideal: "environment" },  // Use back camera by default
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    }
}).then(stream => {
    YAGA.video.srcObject = stream;
    YAGA.video.play();
    YAGA.init();  // Call init after video initialization

    // Render loop
    function render() {
        // Update canvas size if window is resized
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth * window.devicePixelRatio;
            canvas.height = displayHeight * window.devicePixelRatio;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        // Get current stream from video element
        const currentStream = YAGA.video.srcObject;
        if (currentStream) {
            const videoTrack = currentStream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                
                // Determine if camera is back facing by facingMode
                const isBackCamera = settings.facingMode === 'environment';
                const shouldMirror = !isBackCamera;

                // Calculate aspect ratio
                const videoAspect = YAGA.video.videoWidth / YAGA.video.videoHeight;
                const canvasAspect = canvas.width / canvas.height;
                const aspectRatio = videoAspect / canvasAspect;

                // Update video texture
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, YAGA.video);

                // Clear canvas
                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Use shader program
                gl.useProgram(program);

                // Set up position attribute
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

                // Set up texture coordinate attribute
                gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                gl.enableVertexAttribArray(texCoordLocation);
                gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

                // Set uniforms
                gl.uniform1i(imageLocation, 0);
                gl.uniform1i(mirrorLocation, shouldMirror);
                gl.uniform1f(aspectRatioLocation, aspectRatio);

                // Draw
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        }
        
        // Request next frame
        requestAnimationFrame(render);
    }
    
    // Start render loop
    render();
    
}).catch(err => {
    console.error("Error accessing camera:", err);
});