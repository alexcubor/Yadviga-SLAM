// Mapping visualizer initialization
let mappingVisualizer = null;

// Function to initialize
function initMappingVisualizer() {
    if (!window._threeScene) {
        console.error('Three.js scene not initialized');
        return;
    }
    
    // Create geometry for points
    const pointGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    // Function to update visualization
    function updateVisualization() {
        // Get number of points from C++
        const numPoints = Module._getMapPointsCount();
        const points = new Float32Array(numPoints * 3);
        
        // Get points from C++
        Module._getMapPoints(points);
        
        // Clear previous points
        while(window._threeScene.children.length > 0) {
            window._threeScene.remove(window._threeScene.children[0]);
        }
        
        // Add new points
        for (let i = 0; i < numPoints; i++) {
            const point = new THREE.Mesh(pointGeometry, pointMaterial);
            point.position.set(
                points[i * 3],     // x
                points[i * 3 + 1], // y
                points[i * 3 + 2]  // z
            );
            window._threeScene.add(point);
        }
        
        // Output coordinates of points only if they are not all zeros
        if (numPoints > 0) {
            const hasNonZeroPoints = Array.from(points).some(coord => coord !== 0);
            if (hasNonZeroPoints) {
                console.log('Map points:', numPoints, 'points with non-zero coordinates');
            }
        }
        
        // Run next frame
        requestAnimationFrame(updateVisualization);
    }
    
    // Start updating
    updateVisualization();
}

// Ждем события gl-ready
window.addEventListener('gl-ready', function(event) {
    // Initialize Three.js scene
    Module._initThreeScene();
    // Initialize visualization after scene creation
    setTimeout(initMappingVisualizer, 1000);
}); 