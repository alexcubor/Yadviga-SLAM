// Create FPS counter element
const fpsCounter = document.createElement('div');
fpsCounter.id = 'test-fps-counter';
fpsCounter.style.position = 'fixed';
fpsCounter.style.top = '10px';
fpsCounter.style.right = '10px';
fpsCounter.style.color = 'white';
fpsCounter.style.fontFamily = 'monospace';
fpsCounter.style.fontSize = '16px';
fpsCounter.style.backgroundColor = 'rgba(0,0,0,0.5)';
fpsCounter.style.padding = '5px';
fpsCounter.style.borderRadius = '5px';
fpsCounter.style.zIndex = '1000';
fpsCounter.textContent = 'FPS: 0';
document.body.appendChild(fpsCounter);

// Initialize FPS tracking variables
let lastFrameTime = performance.now();
let frameCount = 0;

// Function to update FPS counter
function updateFPS() {
    const now = performance.now();
    frameCount++;

    if (now - lastFrameTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastFrameTime));
        fpsCounter.textContent = 'FPS: ' + fps;
        frameCount = 0;
        lastFrameTime = now;
    }

    requestAnimationFrame(updateFPS);
}

// Start FPS counter
updateFPS();