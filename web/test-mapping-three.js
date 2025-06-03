// Mapping visualizer initialization
console.log('🗺️ Enable test-mapping.js');
let mappingVisualizer = null;

function addCameraFrustumForDebug() {
    if (!window._threeScene) {
        console.error('[test-mapping] No _threeScene for camera frustum');
        return;
    }
    // Parameters for frustum
    const frustumHeight = 0.3;
    const frustumBase = 0.2;
    const frustumGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        0, 0, 0,
        -frustumBase/2, -frustumBase/2, frustumHeight,
         frustumBase/2, -frustumBase/2, frustumHeight,
         frustumBase/2,  frustumBase/2, frustumHeight,
        -frustumBase/2,  frustumBase/2, frustumHeight
    ]);
    frustumGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const indices = [
        0,1,2,  0,2,3,  0,3,4,  0,4,1, // sides
        1,2,3,  1,3,4 // base
    ];
    frustumGeometry.setIndex(indices);
    frustumGeometry.computeVertexNormals();
    const frustumMaterial = new THREE.MeshBasicMaterial({ color: 0xff00cc, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const cameraFrustum = new THREE.Mesh(frustumGeometry, frustumMaterial);
    cameraFrustum.position.set(0, 1.5, 2);
    window._threeScene.add(cameraFrustum);
    console.log('[test-mapping] (DEBUG) Camera frustum added:', cameraFrustum);
    console.log('[test-mapping] (DEBUG) Camera frustum position:', cameraFrustum.position);
    console.log('[test-mapping] (DEBUG) Scene children after camera add:', window._threeScene.children.length);
}

// Function to initialize
function initMappingVisualizer() {
    console.log('[test-mapping] initMappingVisualizer called');
    if (!window._threeScene) {
        console.error('Three.js scene not initialized');
        return;
    }
    
    // Create geometry for points
    const pointGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    // --- Camera Frustum (Pyramid) ---
    // Parameters for frustum
    const frustumHeight = 0.3;
    const frustumBase = 0.2;
    // Vertices: tip at (0,0,0), base is a square in z+ direction
    const frustumGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        // Tip
        0, 0, 0,
        // Base (4 corners)
        -frustumBase/2, -frustumBase/2, frustumHeight,
         frustumBase/2, -frustumBase/2, frustumHeight,
         frustumBase/2,  frustumBase/2, frustumHeight,
        -frustumBase/2,  frustumBase/2, frustumHeight
    ]);
    frustumGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    // Faces (4 sides + base)
    const indices = [
        0,1,2,  0,2,3,  0,3,4,  0,4,1, // sides
        1,2,3,  1,3,4 // base
    ];
    frustumGeometry.setIndex(indices);
    frustumGeometry.computeVertexNormals();
    const frustumMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const cameraFrustum = new THREE.Mesh(frustumGeometry, frustumMaterial);
    cameraFrustum.position.set(0, 1.5, 2); // 1.5m height, 2m back
    window._threeScene.add(cameraFrustum);
    console.log('[test-mapping] Camera frustum created:', cameraFrustum);
    console.log('[test-mapping] Camera frustum position:', cameraFrustum.position);
    console.log('[test-mapping] Scene children after camera add:', window._threeScene.children.length);
    
    // Function to update visualization
    function updateVisualization() {
        // Get number of points from C++
        const numPoints = Module._getMapPointsCount();
        const points = new Float32Array(numPoints * 3);
        
        // Get points from C++
        Module._getMapPoints(points);
        
        // Clear previous points but keep camera frustum
        while(window._threeScene.children.length > 1) {
            window._threeScene.remove(window._threeScene.children[1]);
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
        // Log scene children count for debug
        if (window._threeScene) {
            console.log('[test-mapping] Scene children count:', window._threeScene.children.length);
        }
        // Run next frame
        requestAnimationFrame(updateVisualization);
    }
    
    // Start updating
    updateVisualization();
}

function startMappingWhenReady() {
    console.log('[test-mapping] startMappingWhenReady called');
    if (typeof Module !== 'undefined' && Module._getMapPointsCount) {
        initMappingVisualizer();
    } else if (typeof Module !== 'undefined' && Module['onRuntimeInitialized']) {
        Module['onRuntimeInitialized'] = function() {
            initMappingVisualizer();
        };
    } else {
        // Try later if Module is not defined
        setTimeout(startMappingWhenReady, 100);
    }
}

// Wait for scene to appear
console.log('[test-mapping] MutationObserver set up');
const observer = new MutationObserver(() => {
    console.log('[test-mapping] MutationObserver triggered');
    if (window._threeScene) {
        observer.disconnect();
        addCameraFrustumForDebug();
        startMappingWhenReady();
    }
});
observer.observe(document, { childList: true, subtree: true });