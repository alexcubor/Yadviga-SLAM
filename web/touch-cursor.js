// Hide default cursor
document.body.style.cursor = 'none';

// Create SVG container
const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svgContainer.style.position = 'fixed';
svgContainer.style.pointerEvents = 'none';
svgContainer.style.zIndex = '9999';
svgContainer.style.width = '100%';
svgContainer.style.height = '100%';
svgContainer.style.top = '0';
svgContainer.style.left = '0';
document.body.appendChild(svgContainer);

// Create path for the trail
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
path.setAttribute('fill', 'none');
path.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
path.setAttribute('stroke-width', '40');
path.setAttribute('stroke-linecap', 'round');
path.setAttribute('stroke-linejoin', 'round');
svgContainer.appendChild(path);

// Variables for smooth movement
let currentX = window.innerWidth / 2;
let currentY = window.innerHeight / 2;
let targetX = currentX;
let targetY = currentY;
let isAnimating = true;
let lastDX = 0;
let lastDY = 0;
let isOutside = false;

// Trail positions history
const trailLength = 4;
const positions = Array(trailLength).fill().map(() => ({ x: currentX, y: currentY }));

// Function to create smooth path from points
function createSmoothPath(points) {
    if (points.length < 2) return '';
    
    let pathData = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        pathData += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${xc} ${yc}`;
    }
    
    return pathData;
}

// Smooth movement function
function updateCursorPosition() {
    if (!isAnimating) return;
    
    // Update positions history
    positions.unshift({ x: targetX, y: targetY });
    positions.pop();
    
    // Update current position
    currentX += (targetX - currentX) * 0.3;
    currentY += (targetY - currentY) * 0.3;
    
    // If outside, continue movement in the same direction
    if (isOutside) {
        targetX += lastDX;
        targetY += lastDY;
    }
    
    // Create smooth path
    const pathData = createSmoothPath(positions);
    path.setAttribute('d', pathData);
    
    requestAnimationFrame(updateCursorPosition);
}

// Start animation loop
requestAnimationFrame(updateCursorPosition);

// Update cursor position for mouse movement
document.addEventListener('mousemove', (e) => {
    // Calculate movement direction
    lastDX = e.clientX - targetX;
    lastDY = e.clientY - targetY;
    
    targetX = e.clientX;
    targetY = e.clientY;
    isAnimating = true;
    isOutside = false;
    svgContainer.style.display = 'block';
});

// Handle mouse leaving the window
document.addEventListener('mouseleave', (e) => {
    const rect = document.documentElement.getBoundingClientRect();
    
    // If mouse is outside the viewport, continue movement
    if (e.clientX < 0 || e.clientX > rect.width || e.clientY < 0 || e.clientY > rect.height) {
        isOutside = true;
        isAnimating = true;
        svgContainer.style.display = 'block';
    }
});

// Update cursor position for touch events
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    
    // Calculate movement direction
    lastDX = touch.clientX - targetX;
    lastDY = touch.clientY - targetY;
    
    targetX = touch.clientX;
    targetY = touch.clientY;
    isAnimating = true;
    isOutside = false;
    svgContainer.style.display = 'block';
});

// Handle window focus/blur
window.addEventListener('blur', () => {
    svgContainer.style.display = 'none';
});

window.addEventListener('focus', () => {
    svgContainer.style.display = 'block';
    isAnimating = true;
});

// Add touch start/end events
document.addEventListener('touchstart', () => {
    svgContainer.style.display = 'block';
    path.setAttribute('stroke-width', '40');
    isAnimating = true;
});

document.addEventListener('touchend', () => {
    svgContainer.style.display = 'none';
    path.setAttribute('stroke-width', '20');
    isAnimating = false;
}); 