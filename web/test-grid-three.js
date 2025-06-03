// Enable log for three.js
console.log('🎲 Enable three.js');

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
        window._threeCamera.position.set(0, 1.5, 2);  // Поднимаем камеру и отодвигаем назад
        window._threeCamera.lookAt(0, 0, 0);  // Смотрим в центр сцены
        
        // Add grid helper
        var gridHelper = new THREE.GridHelper(10, 10, 0x0000ff, 0x808080);
        window._threeScene.add(gridHelper);
        
        // === Add axis labels and unit label (meters) ===
        function makeTextSprite(message, parameters) {
            if (parameters === undefined) parameters = {};
            var fontface = parameters.hasOwnProperty('fontface') ? parameters['fontface'] : 'Arial';
            var fontsize = parameters.hasOwnProperty('fontsize') ? parameters['fontsize'] : 48;
            var borderThickness = parameters.hasOwnProperty('borderThickness') ? parameters['borderThickness'] : 2;
            var borderColor = parameters.hasOwnProperty('borderColor') ? parameters['borderColor'] : { r:0, g:0, b:0, a:1.0 };
            var backgroundColor = parameters.hasOwnProperty('backgroundColor') ? parameters['backgroundColor'] : { r:255, g:255, b:255, a:0.0 };
            var textColor = parameters.hasOwnProperty('textColor') ? parameters['textColor'] : { r:0, g:0, b:0, a:1.0 };

            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            context.font = fontsize + 'px ' + fontface;
            // get size data (height depends only on font size)
            var metrics = context.measureText(message);
            var textWidth = metrics.width;
            canvas.width = textWidth + borderThickness * 8;
            canvas.height = fontsize + borderThickness * 8;
            // Need to set font again after resizing canvas
            context.font = fontsize + 'px ' + fontface;
            // background
            context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
            context.fillRect(0, 0, canvas.width, canvas.height);
            // border
            context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;
            context.lineWidth = borderThickness;
            context.strokeRect(0, 0, canvas.width, canvas.height);
            // text
            context.fillStyle = `rgba(${textColor.r},${textColor.g},${textColor.b},${textColor.a})`;
            context.textAlign = 'left';
            context.textBaseline = 'top';
            context.fillText(message, borderThickness * 4, borderThickness * 4);
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
            var sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.5, 0.25, 1.0); // size in world units
            return sprite;
        }

        // Add labels along X and Z axes
        for (let i = -5; i <= 5; i++) {
            if (i === 0) continue;
            // X axis labels
            let labelX = makeTextSprite(i.toString(), { fontsize: 64, textColor: {r:0,g:0,b:255,a:1} });
            labelX.position.set(i, 0.01, 0);
            window._threeScene.add(labelX);
            // Z axis labels
            let labelZ = makeTextSprite(i.toString(), { fontsize: 64, textColor: {r:255,g:0,b:0,a:1} });
            labelZ.position.set(0, 0.01, i);
            window._threeScene.add(labelZ);
        }
        // Add 'meters' label
        let metersLabel = makeTextSprite('meters', { fontsize: 48, textColor: {r:0,g:0,b:0,a:1} });
        metersLabel.position.set(5.5, 0.01, 0);
        window._threeScene.add(metersLabel);
        
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