// Load Three.js if not already loaded
if (!window.THREE) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = function() {
        initScene();
    };
    document.head.appendChild(script);
} else {
    initScene();
}

function initScene() {
    // Create Three.js scene if it doesn't exist
    if (!window._threeScene) {
        // Create scene
        window._threeScene = new THREE.Scene();
        
        // Get main canvas size
        var mainCanvas = document.getElementById('xr-canvas');
        var canvasWidth = mainCanvas.width;
        var canvasHeight = mainCanvas.height;
        
        // Create camera with correct aspect ratio
        window._threeCamera = new THREE.PerspectiveCamera(
            75,
            canvasWidth / canvasHeight,
            0.1,
            1000
        );
        window._threeCamera.position.set(0, 5, 5);  // Поднимаем камеру и отодвигаем назад
        window._threeCamera.lookAt(0, 0, 0);  // Смотрим в центр сцены
        
        // Add grid helper
        var gridHelper = new THREE.GridHelper(10, 10, 0x0000ff, 0x808080);
        window._threeScene.add(gridHelper);
        
        // Add axes helper
        var axesHelper = new THREE.AxesHelper(5);
        window._threeScene.add(axesHelper);
        
        // Create renderer
        var rendererOptions = Object.create(null);
        rendererOptions.alpha = true;
        rendererOptions.antialias = true;
        window._threeRenderer = new THREE.WebGLRenderer(rendererOptions);
        
        // Set Three.js canvas size to match main canvas
        window._threeRenderer.setSize(canvasWidth, canvasHeight);
        window._threeRenderer.setClearColor(0x000000, 0);
        
        // Style the canvas to match main canvas
        var canvas = window._threeRenderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = mainCanvas.style.width;
        canvas.style.height = mainCanvas.style.height;
        canvas.style.zIndex = '2';
        
        // Add renderer to DOM
        document.body.appendChild(canvas);
        
        // Add mouse navigation
        let isDragging = false;
        var previousMousePosition = Object.create(null);
        previousMousePosition.x = 0;
        previousMousePosition.y = 0;
        
        // Camera orbit parameters
        var cameraDistance = 7;  // Distance from camera to center
        var cameraPhi = Math.PI / 4;  // Angle of inclination (vertical)
        var cameraTheta = 0;  // Angle of rotation (horizontal)
        
        function updateCameraPosition() {
            // Convert spherical coordinates to Cartesian
            window._threeCamera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
            window._threeCamera.position.y = cameraDistance * Math.cos(cameraPhi);
            window._threeCamera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
            window._threeCamera.lookAt(0, 0, 0);
        }
        
        // Set initial camera position
        updateCameraPosition();
        
        canvas.addEventListener('mousedown', function(e) {
            isDragging = true;
            previousMousePosition.x = e.clientX;
            previousMousePosition.y = e.clientY;
        });

        canvas.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            var deltaMove = Object.create(null);
            deltaMove.x = e.clientX - previousMousePosition.x;
            deltaMove.y = e.clientY - previousMousePosition.y;

            // Update angles (inverted rotation)
            cameraTheta += deltaMove.x * 0.01;  // Inverted horizontal rotation
            cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi - deltaMove.y * 0.01));  // Inverted vertical rotation

            // Обновляем позицию камеры
            updateCameraPosition();

            previousMousePosition.x = e.clientX;
            previousMousePosition.y = e.clientY;
        });

        canvas.addEventListener('mouseup', function() {
            isDragging = false;
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            // Update main canvas size
            var mainCanvas = document.getElementById('xr-canvas');
            var canvasWidth = mainCanvas.width;
            var canvasHeight = mainCanvas.height;
            
            // Update Three.js canvas size
            window._threeCamera.aspect = canvasWidth / canvasHeight;
            window._threeCamera.updateProjectionMatrix();
            window._threeRenderer.setSize(canvasWidth, canvasHeight);
            canvas.style.width = mainCanvas.style.width;
            canvas.style.height = mainCanvas.style.height;
        });

        // Add to render pipeline
        if (!window._renderPipeline) {
            window._renderPipeline = [];
        }
        var renderStage = Object.create(null);
        renderStage.render = function(gl) {
            // Render Three.js scene
            window._threeRenderer.render(window._threeScene, window._threeCamera);
        };
        window._renderPipeline.push(renderStage);

        // Start animation loop
        function animate() {
            requestAnimationFrame(animate);
            window._threeRenderer.render(window._threeScene, window._threeCamera);
        }
        animate();
    }
} 