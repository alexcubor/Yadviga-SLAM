// Load Three.js if not already loaded
if (!window.THREE) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = function() {
        waitForCanvasAndInit();
    };
    document.head.appendChild(script);
} else {
    waitForCanvasAndInit();
}

function waitForCanvasAndInit() {
    const mainCanvas = document.getElementById('xr-canvas');
    if (mainCanvas) {
        initScene();
    } else {
        setTimeout(waitForCanvasAndInit, 50);
    }
}

// === GLTFLoader for loading GLB models ===
function loadGLTFLoader(callback) {
    if (window.THREE && THREE.GLTFLoader) {
        callback();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function addCharacterModel(scene) {
    const loader = new THREE.GLTFLoader();
    loader.load('sky_character.glb', function(gltf) {
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        scene.add(model);

        // Find all light sources in the model
        const lights = [];
        model.traverse((node) => {
            if (node.isLight) {
                lights.push(node);
            }
        });

        // Add helpers for each light
        lights.forEach(light => {
            let helper;
            if (light.type === 'DirectionalLight') {
                helper = new THREE.DirectionalLightHelper(light, 0.125);
            } else if (light.type === 'PointLight') {
                helper = new THREE.PointLightHelper(light, 0.125);
                // For PointLight just add helper without toggle
                if (helper) {
                    scene.add(helper);
                    helper.visible = window.toggleAllInput ? window.toggleAllInput.checked : true;
                    // Add to the global helpers list
                    if (window.lightHelpers) {
                        window.lightHelpers.set(light, { helper, checkbox: window.toggleAllInput });
                    }
                }
                return; // Skip creating toggle for PointLight
            } else if (light.type === 'SpotLight') {
                helper = new THREE.SpotLightHelper(light);
            } else if (light.type === 'HemisphereLight') {
                helper = new THREE.HemisphereLightHelper(light, 0.125);
            }

            if (helper) {
                scene.add(helper);
                // Add toggle for this light
                if (window.lightsUI && window.lightsInfo) {
                    const toggle = createLightToggle(light, helper);
                    window.lightsUI.insertBefore(toggle, window.lightsInfo);
                    
                    // Set initial visibility state
                    if (window.toggleAllInput) {
                        helper.visible = window.toggleAllInput.checked;
                    }
                }
            }
        });

        // === Auto-start animation if available ===
        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(clip => {
                mixer.clipAction(clip).play();
            });
            // Save mixer for animation loop update
            window._threeAnimationMixers = window._threeAnimationMixers || [];
            window._threeAnimationMixers.push(mixer);
        }
    }, undefined, function(error) {
        // ignore
    });
}

function initScene() {
    // Create Three.js scene if it doesn't exist
    if (!window._threeScene) {
        // Create scene
        window._threeScene = new THREE.Scene();
        
        // Get main canvas size
        var mainCanvas = document.getElementById('xr-canvas');
        if (!mainCanvas) {
            // ignore
            return;
        }
        
        var canvasWidth = mainCanvas.width;
        var canvasHeight = mainCanvas.height;
        
        // Create camera with correct aspect ratio
        window._threeCamera = new THREE.PerspectiveCamera(
            75,
            canvasWidth / canvasHeight,
            0.1,
            1000
        );
        
        // Set initial position
        window._threeCamera.position.set(0, 1, 2);  // Raise camera and move back
        window._threeCamera.lookAt(0, 0, 0);  // Look at scene center
        
        // Initialize orbital camera parameters
        const pos = window._threeCamera.position;
        cameraDistance = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        cameraPhi = Math.acos(pos.y / cameraDistance);
        cameraTheta = Math.atan2(pos.z, pos.x);
        cameraTarget = { x: 0, y: 0, z: 0 };

        // === UI for camera transformations ===
        const ui = document.createElement('div');
        ui.style.width = '18rem';
        ui.style.border = 'none';
        ui.style.borderRadius = '0.5rem';
        ui.style.fontFamily = 'monospace';
        ui.style.fontSize = '1rem';
        ui.style.color = 'white';

        const title = document.createElement('div');
        title.textContent = 'Camera';
        title.style.color = 'white';
        title.style.marginBottom = '0.5rem';
        title.style.fontWeight = 'bold';
        ui.appendChild(title);

        const translate = document.createElement('div');
        translate.style.color = 'white';
        translate.style.marginBottom = '0.5rem';
        ui.appendChild(translate);

        const rotate = document.createElement('div');
        rotate.style.color = 'white';
        rotate.style.marginBottom = '1rem';
        ui.appendChild(rotate);

        // === UI for lights ===
        window.lightsUI = document.createElement('div');
        window.lightsUI.style.width = '18rem';
        window.lightsUI.style.border = 'none';
        window.lightsUI.style.borderRadius = '0.5rem';
        window.lightsUI.style.fontFamily = 'monospace';
        window.lightsUI.style.fontSize = '1rem';
        window.lightsUI.style.color = 'white';

        const lightsTitle = document.createElement('div');
        lightsTitle.style.display = 'flex';
        lightsTitle.style.alignItems = 'center';
        lightsTitle.style.justifyContent = 'space-between';
        lightsTitle.style.marginBottom = '0.5rem';

        const titleText = document.createElement('span');
        titleText.textContent = 'Lights';
        titleText.style.color = 'white';
        titleText.style.fontWeight = 'bold';

        const toggleAllSwitch = document.createElement('label');
        toggleAllSwitch.style.position = 'relative';
        toggleAllSwitch.style.display = 'inline-block';
        toggleAllSwitch.style.width = '3.5rem';
        toggleAllSwitch.style.height = '1.75rem';

        window.toggleAllInput = document.createElement('input');
        window.toggleAllInput.type = 'checkbox';
        window.toggleAllInput.style.opacity = '0';
        window.toggleAllInput.style.width = '0';
        window.toggleAllInput.style.height = '0';
        window.toggleAllInput.checked = false;

        const toggleAllSlider = document.createElement('span');
        toggleAllSlider.style.position = 'absolute';
        toggleAllSlider.style.cursor = 'pointer';
        toggleAllSlider.style.top = '0';
        toggleAllSlider.style.left = '0';
        toggleAllSlider.style.right = '0';
        toggleAllSlider.style.bottom = '0';
        toggleAllSlider.style.backgroundColor = '#ccc';
        toggleAllSlider.style.transition = '.4s';
        toggleAllSlider.style.borderRadius = '1.75rem';

        const toggleAllKnob = document.createElement('span');
        toggleAllKnob.style.position = 'absolute';
        toggleAllKnob.style.content = '""';
        toggleAllKnob.style.height = '1.5rem';
        toggleAllKnob.style.width = '1.5rem';
        toggleAllKnob.style.left = '0.125rem';
        toggleAllKnob.style.bottom = '0.125rem';
        toggleAllKnob.style.backgroundColor = 'white';
        toggleAllKnob.style.transition = '.4s';
        toggleAllKnob.style.borderRadius = '50%';
        toggleAllKnob.style.transform = 'translateX(0)';

        window.toggleAllInput.onchange = () => {
            toggleAllSlider.style.backgroundColor = window.toggleAllInput.checked ? '#007AFF' : '#ccc';
            toggleAllKnob.style.transform = window.toggleAllInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';
            if (window.lightHelpers) {
                window.lightHelpers.forEach(({ helper, checkbox }) => {
                    helper.visible = window.toggleAllInput.checked;
                    checkbox.checked = window.toggleAllInput.checked;
                });
            }
        };

        toggleAllSwitch.appendChild(window.toggleAllInput);
        toggleAllSwitch.appendChild(toggleAllSlider);
        toggleAllSwitch.appendChild(toggleAllKnob);
        lightsTitle.appendChild(titleText);
        lightsTitle.appendChild(toggleAllSwitch);
        window.lightsUI.appendChild(lightsTitle);

        window.lightsInfo = document.createElement('div');
        window.lightsInfo.style.color = 'white';
        window.lightsUI.appendChild(window.lightsInfo);

        // Хранилище для хелперов и их переключателей
        window.lightHelpers = new Map();

        // Функция для создания переключателя для отдельного света
        window.createLightToggle = function(light, helper) {
            const toggle = document.createElement('div');
            toggle.style.display = 'flex';
            toggle.style.alignItems = 'center';
            toggle.style.justifyContent = 'space-between';
            toggle.style.marginTop = '0.5rem';

            const label = document.createElement('span');
            label.textContent = light.name || 'Light';

            const switchElement = document.createElement('label');
            switchElement.style.position = 'relative';
            switchElement.style.display = 'inline-block';
            switchElement.style.width = '3.5rem';
            switchElement.style.height = '1.75rem';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.style.opacity = '0';
            input.style.width = '0';
            input.style.height = '0';
            input.checked = true;

            const slider = document.createElement('span');
            slider.style.position = 'absolute';
            slider.style.cursor = 'pointer';
            slider.style.top = '0';
            slider.style.left = '0';
            slider.style.right = '0';
            slider.style.bottom = '0';
            slider.style.backgroundColor = '#007AFF';
            slider.style.transition = '.4s';
            slider.style.borderRadius = '1.75rem';

            const knob = document.createElement('span');
            knob.style.position = 'absolute';
            knob.style.content = '""';
            knob.style.height = '1.5rem';
            knob.style.width = '1.5rem';
            knob.style.left = '0.125rem';
            knob.style.bottom = '0.125rem';
            knob.style.backgroundColor = 'white';
            knob.style.transition = '.4s';
            knob.style.borderRadius = '50%';
            knob.style.transform = 'translateX(1.75rem)';

            input.onchange = () => {
                slider.style.backgroundColor = input.checked ? '#007AFF' : '#ccc';
                knob.style.transform = input.checked ? 'translateX(1.75rem)' : 'translateX(0)';
                helper.visible = input.checked;
            };

            switchElement.appendChild(input);
            switchElement.appendChild(slider);
            switchElement.appendChild(knob);
            toggle.appendChild(label);
            toggle.appendChild(switchElement);

            // Сохраняем хелпер и его переключатель
            window.lightHelpers.set(light, { helper, checkbox: input });

            return toggle;
        };

        // === UI for grid ===
        window.gridUI = document.createElement('div');
        window.gridUI.style.width = '18rem';
        window.gridUI.style.border = 'none';
        window.gridUI.style.borderRadius = '0.5rem';
        window.gridUI.style.fontFamily = 'monospace';
        window.gridUI.style.fontSize = '1rem';
        window.gridUI.style.color = 'white';
        window.gridUI.style.marginTop = '1rem';

        const gridTitle = document.createElement('div');
        gridTitle.style.display = 'flex';
        gridTitle.style.alignItems = 'center';
        gridTitle.style.justifyContent = 'space-between';
        gridTitle.style.marginBottom = '0.5rem';

        const gridTitleText = document.createElement('span');
        gridTitleText.textContent = 'Grid';
        gridTitleText.style.color = 'white';
        gridTitleText.style.fontWeight = 'bold';

        const gridSwitch = document.createElement('label');
        gridSwitch.style.position = 'relative';
        gridSwitch.style.display = 'inline-block';
        gridSwitch.style.width = '3.5rem';
        gridSwitch.style.height = '1.75rem';

        window.gridToggleInput = document.createElement('input');
        window.gridToggleInput.type = 'checkbox';
        window.gridToggleInput.style.opacity = '0';
        window.gridToggleInput.style.width = '0';
        window.gridToggleInput.style.height = '0';
        window.gridToggleInput.checked = true;  // По умолчанию включен

        const gridSlider = document.createElement('span');
        gridSlider.style.position = 'absolute';
        gridSlider.style.cursor = 'pointer';
        gridSlider.style.top = '0';
        gridSlider.style.left = '0';
        gridSlider.style.right = '0';
        gridSlider.style.bottom = '0';
        gridSlider.style.backgroundColor = '#007AFF';  // Начальный цвет синий
        gridSlider.style.transition = '.4s';
        gridSlider.style.borderRadius = '1.75rem';

        const gridKnob = document.createElement('span');
        gridKnob.style.position = 'absolute';
        gridKnob.style.content = '""';
        gridKnob.style.height = '1.5rem';
        gridKnob.style.width = '1.5rem';
        gridKnob.style.left = '0.125rem';
        gridKnob.style.bottom = '0.125rem';
        gridKnob.style.backgroundColor = 'white';
        gridKnob.style.transition = '.4s';
        gridKnob.style.borderRadius = '50%';
        gridKnob.style.transform = 'translateX(1.75rem)';  // Начальная позиция справа

        window.gridToggleInput.onchange = () => {
            gridSlider.style.backgroundColor = window.gridToggleInput.checked ? '#007AFF' : '#ccc';
            gridKnob.style.transform = window.gridToggleInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';
            // Control visibility of all helper elements
            if (window.gridHelper) {
                window.gridHelper.visible = window.gridToggleInput.checked;
            }
            if (window.axesHelper) {
                window.axesHelper.visible = window.gridToggleInput.checked;
            }
            // Control visibility of meter labels
            window._threeScene.children.forEach(child => {
                if (child.isSprite && child.userData.isMeterLabel) {
                    child.visible = window.gridToggleInput.checked;
                }
            });
        };

        gridSwitch.appendChild(window.gridToggleInput);
        gridSwitch.appendChild(gridSlider);
        gridSwitch.appendChild(gridKnob);
        gridTitle.appendChild(gridTitleText);
        gridTitle.appendChild(gridSwitch);
        window.gridUI.appendChild(gridTitle);

        // Добавляем компоненты в test container
        if (window.testContainer) {
            window.testContainer.addComponent('camera', {
                element: ui
            });
            window.testContainer.addComponent('lights', {
                element: window.lightsUI
            });
            window.testContainer.addComponent('grid', {
                element: window.gridUI
            });
        }

        function updateUI() {
            const cam = window._threeCamera;
            if (!cam) return;
            
            // Camera position relative to scene
            const relativePos = cam.position.clone().sub(window._threeScene.position);
            translate.textContent = `Translate: ${relativePos.x.toFixed(2)} ${relativePos.y.toFixed(2)} ${relativePos.z.toFixed(2)}`;
            
            // Camera rotation in degrees
            const euler = new THREE.Euler().setFromQuaternion(cam.quaternion);
            rotate.textContent = `Rotate: ${(euler.x * 180 / Math.PI).toFixed(2)}° ${(euler.y * 180 / Math.PI).toFixed(2)}° ${(euler.z * 180 / Math.PI).toFixed(2)}°`;

            // Update lights info
            const lights = [];
            window._threeScene.traverse((node) => {
                if (node.isLight) {
                    lights.push(node);
                }
            });

            let lightsText = '';
            lights.forEach((light, index) => {
                const pos = light.position;
                const intensity = light.intensity;
                const color = light.color ? `#${light.color.getHexString()}` : 'white';
                lightsText += `${light.name || `Light ${index + 1}`}:\n`;
                lightsText += `  Type: ${light.type}\n`;
                lightsText += `  Position: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`;
                lightsText += `  Intensity: ${intensity.toFixed(2)}\n`;
                lightsText += `  Color: ${color}\n`;
                if (index < lights.length - 1) lightsText += '\n';
            });
            window.lightsInfo.textContent = lightsText;
        }

        function animateUI() {
            updateUI();
            requestAnimationFrame(animateUI);
        }
        animateUI();
        
        // Add grid helper
        var gridSize = 2;
        var gridDivisions = 20;
        // Line color: all gray, slightly darker than main color
        var gridColor = 0x555555;
        window.gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
        window._threeScene.add(window.gridHelper);
        
        // Add axes helper
        window.axesHelper = new THREE.AxesHelper(0.2);
        window._threeScene.add(window.axesHelper);
        
        // === Add axis labels and unit label (meters) ===
        function makeTextSprite(message, parameters) {
            if (parameters === undefined) parameters = {};
            var fontface = parameters.fontface || 'Arial';
            var fontsize = parameters.fontsize || 48;
            var borderThickness = parameters.borderThickness || 0;
            var borderColor = parameters.borderColor || { r:0, g:0, b:0, a:1.0 };
            var backgroundColor = parameters.backgroundColor || { r:255, g:255, b:255, a:0.0 };
            var textColor = parameters.textColor || { r:0, g:0, b:0, a:1.0 };

            // Create canvas just big enough for the text
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            context.font = fontsize + 'px ' + fontface;
            var metrics = context.measureText(message);
            var textWidth = Math.ceil(metrics.width);
            var textHeight = fontsize * 1.2;
            canvas.width = textWidth + borderThickness * 8;
            canvas.height = textHeight + borderThickness * 8;
            context.font = fontsize + 'px ' + fontface;

            // background
            context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
            context.fillRect(0, 0, canvas.width, canvas.height);

            // border (draw only if borderThickness > 0)
            if (borderThickness > 0) {
                context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;
                context.lineWidth = borderThickness;
                context.strokeRect(0, 0, canvas.width, canvas.height);
            }

            // text
            context.fillStyle = `rgba(${textColor.r},${textColor.g},${textColor.b},${textColor.a})`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(message, canvas.width / 2, canvas.height / 2);

            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
            var sprite = new THREE.Sprite(spriteMaterial);
            sprite.userData.isMeterLabel = true;  // Mark as meter label

            // Automatically adjust scale to make numbers compact and prevent stretching
            var scaleFactor = 0.10;
            sprite.scale.set(scaleFactor * (canvas.width / canvas.height), scaleFactor, 1.0);

            return sprite;
        }

        // Add labels along X and Z axes
        for (let i = -5; i <= 5; i++) {
            if (i === 0) continue;
            if (Math.abs(i) > 1) continue;
            // X axis labels
            let labelX = makeTextSprite(i.toString() + 'm', { fontsize: 64, textColor: {r:0,g:0,b:255,a:1}, borderThickness: 0 });
            labelX.position.set(i, 0.01, 0);
            window._threeScene.add(labelX);
            // Z axis labels
            let labelZ = makeTextSprite(i.toString() + 'm', { fontsize: 64, textColor: {r:255,g:0,b:0,a:1}, borderThickness: 0 });
            labelZ.position.set(0, 0.01, i);
            window._threeScene.add(labelZ);
        }
        
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
        canvas.style.width = '100%';  // Changed from mainCanvas.style.width
        canvas.style.height = '100%'; // Changed from mainCanvas.style.height
        canvas.style.zIndex = '2';
        
        // Add renderer to DOM
        document.body.appendChild(canvas);
        
        // Add mouse navigation
        let isDragging = false;
        let isPanning = false;
        var previousMousePosition = Object.create(null);
        previousMousePosition.x = 0;
        previousMousePosition.y = 0;
        let panStart = { x: 0, y: 0 };
        let panTargetStart = { x: 0, y: 0, z: 0 };
        
        // Camera orbit parameters
        var minCameraDistance = 0.5;
        var maxCameraDistance = 10;
        
        function updateCameraPosition() {
            // Convert spherical coordinates to Cartesian
            window._threeCamera.position.x = cameraTarget.x + cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
            window._threeCamera.position.y = cameraTarget.y + cameraDistance * Math.cos(cameraPhi);
            window._threeCamera.position.z = cameraTarget.z + cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
            window._threeCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
        }
        
        // Set initial camera position
        updateCameraPosition();
        
        canvas.addEventListener('mousedown', function(e) {
            if (e.button === 2) { // right button
                isPanning = true;
                panStart.x = e.clientX;
                panStart.y = e.clientY;
                panTargetStart.x = cameraTarget.x;
                panTargetStart.y = cameraTarget.y;
                panTargetStart.z = cameraTarget.z;
            } else if (e.button === 0) { // left button
                isDragging = true;
                previousMousePosition.x = e.clientX;
                previousMousePosition.y = e.clientY;
            }
        });

        canvas.addEventListener('mousemove', function(e) {
            if (isDragging) {
                var deltaMove = Object.create(null);
                deltaMove.x = e.clientX - previousMousePosition.x;
                deltaMove.y = e.clientY - previousMousePosition.y;
                // Update angles (inverted rotation)
                cameraTheta += deltaMove.x * 0.01;  // Inverted horizontal rotation
                cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi - deltaMove.y * 0.01));  // Inverted vertical rotation
                updateCameraPosition();
                previousMousePosition.x = e.clientX;
                previousMousePosition.y = e.clientY;
            } else if (isPanning) {
                var dx = e.clientX - panStart.x;
                var dy = e.clientY - panStart.y;
                var panSpeed = cameraDistance * 0.002;
                // Pan in screen coordinates
                var camera = window._threeCamera;
                camera.updateMatrixWorld();
                var right = new THREE.Vector3();
                var up = new THREE.Vector3();
                camera.getWorldDirection(right); // forward
                right.crossVectors(camera.up, right).normalize(); // right = up x forward
                up.copy(camera.up).normalize();
                cameraTarget.x = panTargetStart.x + dx * panSpeed * right.x + dy * panSpeed * up.x;
                cameraTarget.y = panTargetStart.y + dx * panSpeed * right.y + dy * panSpeed * up.y;
                cameraTarget.z = panTargetStart.z + dx * panSpeed * right.z + dy * panSpeed * up.z;
                updateCameraPosition();
            }
        });

        canvas.addEventListener('mouseup', function(e) {
            if (e.button === 2) {
                isPanning = false;
            } else if (e.button === 0) {
                isDragging = false;
            }
        });
        
        canvas.addEventListener('mouseleave', function() {
            isDragging = false;
            isPanning = false;
        });
        // Disable context menu on right click
        canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        
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

        // === Mouse wheel zoom + pan for desktop and trackpad ===
        canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            var panSpeed = cameraDistance * 0.002;
            var camera = window._threeCamera;
            camera.updateMatrixWorld();
            var right = new THREE.Vector3();
            var up = new THREE.Vector3();
            camera.getWorldDirection(right); // forward
            right.crossVectors(camera.up, right).normalize(); // right = up x forward
            up.copy(camera.up).normalize();

            if (e.ctrlKey) {
                // Pinch-zoom (two fingers with pinch)
                var zoomStep = 0.03;
                var delta = e.deltaY > 0 ? (1 + zoomStep) : (1 - zoomStep);
                cameraDistance *= delta;
                cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
            } else {
                // Pan (two fingers on trackpad or mouse wheel with horizontal scroll)
                cameraTarget.x += -e.deltaX * panSpeed * right.x + -e.deltaY * panSpeed * up.x;
                cameraTarget.y += -e.deltaX * panSpeed * right.y + -e.deltaY * panSpeed * up.y;
                cameraTarget.z += -e.deltaX * panSpeed * right.z + -e.deltaY * panSpeed * up.z;
            }
            updateCameraPosition();
        }, { passive: false });

        // === Pinch zoom + pan for touch devices ===
        let lastTouchDist = null;
        let lastTouchCenter = null;
        let panTargetStartTouch = { x: 0, y: 0, z: 0 };
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx*dx + dy*dy);
                lastTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                panTargetStartTouch.x = cameraTarget.x;
                panTargetStartTouch.y = cameraTarget.y;
                panTargetStartTouch.z = cameraTarget.z;
            }
        });
        canvas.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2 && lastTouchDist !== null && lastTouchCenter !== null) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const newDist = Math.sqrt(dx*dx + dy*dy);
                let scale = lastTouchDist / newDist;
                scale = 1 + (scale - 1) * 0.2; // smooth pinch effect
                cameraDistance *= scale;
                cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
                lastTouchDist = newDist;

                // Pan (middle point movement)
                const newCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                const dxCenter = newCenter.x - lastTouchCenter.x;
                const dyCenter = newCenter.y - lastTouchCenter.y;
                var panSpeed = cameraDistance * 0.002;
                var camera = window._threeCamera;
                camera.updateMatrixWorld();
                var right = new THREE.Vector3();
                var up = new THREE.Vector3();
                camera.getWorldDirection(right); // forward
                right.crossVectors(camera.up, right).normalize(); // right = up x forward
                up.copy(camera.up).normalize();
                cameraTarget.x = panTargetStartTouch.x + dxCenter * panSpeed * right.x + dyCenter * panSpeed * up.x;
                cameraTarget.y = panTargetStartTouch.y + dxCenter * panSpeed * right.y + dyCenter * panSpeed * up.y;
                cameraTarget.z = panTargetStartTouch.z + dxCenter * panSpeed * right.z + dyCenter * panSpeed * up.z;
                updateCameraPosition();
                // Don't update panTargetStartTouch to keep pan relative to gesture start
            }
        });
        canvas.addEventListener('touchend', function(e) {
            if (e.touches.length < 2) {
                lastTouchDist = null;
                lastTouchCenter = null;
            }
        });

        // Add touch events for mobile
        canvas.addEventListener('touchstart', function(event) {
            event.preventDefault();
            if (event.touches.length === 1) {
                isDragging = true;
                lastMouseX = event.touches[0].clientX;
                lastMouseY = event.touches[0].clientY;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', function(event) {
            event.preventDefault();
            if (!isDragging) return;

            var touch = event.touches[0];
            var deltaX = touch.clientX - lastMouseX;
            var deltaY = touch.clientY - lastMouseY;

            // Update camera angles
            cameraTheta -= deltaX * 0.01;
            cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + deltaY * 0.01));

            updateCameraPosition();
            lastMouseX = touch.clientX;
            lastMouseY = touch.clientY;
        }, { passive: false });

        canvas.addEventListener('touchend', function(event) {
            event.preventDefault();
            isDragging = false;
        }, { passive: false });

        // Add pinch zoom
        var initialPinchDistance = 0;
        canvas.addEventListener('touchstart', function(event) {
            if (event.touches.length === 2) {
                initialPinchDistance = Math.hypot(
                    event.touches[0].clientX - event.touches[1].clientX,
                    event.touches[0].clientY - event.touches[1].clientY
                );
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', function(event) {
            if (event.touches.length === 2) {
                event.preventDefault();
                var currentDistance = Math.hypot(
                    event.touches[0].clientX - event.touches[1].clientX,
                    event.touches[0].clientY - event.touches[1].clientY
                );
                var delta = (currentDistance - initialPinchDistance) * 0.01;
                cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance - delta));
                initialPinchDistance = currentDistance;
                updateCameraPosition();
            }
        }, { passive: false });

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
            // === Update animations ===
            if (window._threeAnimationMixers) {
                var delta = window._threeRenderer.clock ? window._threeRenderer.clock.getDelta() : 0.016;
                window._threeAnimationMixers.forEach(mixer => mixer.update(delta));
            }
            window._threeRenderer.render(window._threeScene, window._threeCamera);
        }
        // Clock for animations
        window._threeRenderer.clock = new THREE.Clock();
        animate();

        // After scene and renderer are set up:
        loadGLTFLoader(function() {
            addCharacterModel(window._threeScene);
        });
    }
}

// === Synchronize Three.js canvas position with tracking points ===
function updateSceneFromTracking() {
    if (window.Module && window.Module._getTrackingPoints && window.Module.HEAPF32) {
        try {
            const pointsPtr = window.Module._getTrackingPoints();
            const count = window.Module._getTrackingPointsCount();
            if (count > 0 && pointsPtr) {
                const points = new Float32Array(window.Module.HEAPF32.buffer, pointsPtr, count * 2);
                // Calculate average
                let avgX = 0, avgY = 0;
                for (let i = 0; i < count; i++) {
                    avgX += points[i * 2];
                    avgY += points[i * 2 + 1];
                }
                avgX /= count;
                avgY /= count;

                // Get Three.js canvas
                const canvas = window._threeRenderer.domElement;
                
                // Convert tracking coordinates to pixels
                const mainCanvas = document.getElementById('xr-canvas');
                const scaleX = mainCanvas.width / mainCanvas.clientWidth;
                const scaleY = mainCanvas.height / mainCanvas.clientHeight;
                
                // Scale tracking coordinates (increase movement effect)
                const TRACKING_SCALE = 500; // Increase movement effect by 500x
                const offsetX = avgX * TRACKING_SCALE * scaleX;
                const offsetY = -avgY * TRACKING_SCALE * scaleY; // Invert Y coordinate
                
                // Apply transformation to canvas
                canvas.style.position = 'fixed';
                canvas.style.left = '50%';
                canvas.style.top = '50%';
                canvas.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
            }
        } catch (e) {
            // ignore
        }
    }
    requestAnimationFrame(updateSceneFromTracking);
}
updateSceneFromTracking(); 