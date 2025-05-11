// Module for adding a rotating cube to the Three.js scene
(function() {
    // Wait for Three.js scene to be initialized
    function waitForScene() {
        if (window._threeScene) {
            initCube();
        } else {
            setTimeout(waitForScene, 100);
        }
    }

    function initCube() {
        // Create cube geometry
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create material with wireframe
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true
        });

        // Create mesh
        const cube = new THREE.Mesh(geometry, material);
        
        // Add cube to scene
        window._threeScene.add(cube);

        // Animation function
        function animate() {
            requestAnimationFrame(animate);

        }

        // Start animation
        animate();
    }

    // Start waiting for scene
    waitForScene();
})();
