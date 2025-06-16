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

// === Camera snap functionality ===
let initialCameraState = null;
const SNAP_THRESHOLD = 0.5; // Increased from 0.2 to 0.5 for wider snap range
const SNAP_ANGLE_THRESHOLD = 0.5; // Increased from 0.2 to 0.5 for wider angle snap range

// Easing function for smooth snapping
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Global camera parameters
let cameraDistance = 2;
let cameraPhi = Math.PI / 4;
let cameraTheta = 0;
let cameraTarget = { x: 0, y: 0.5, z: 0 };

// Add snap progress tracking
let snapProgress = 0;
let isSnapping = false;
let shouldCheckSnap = false;

// Add inertia tracking
let lastMouseDelta = { x: 0, y: 0 };
let cameraInertia = { x: 0, y: 0 };
let isInertiaActive = false;
const INERTIA_DECAY = 0.95; // How quickly inertia fades (0.95 = 5% reduction per frame)

function updateCameraPosition() {
    // Convert spherical coordinates to Cartesian
    window._threeCamera.position.x = cameraTarget.x + cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    window._threeCamera.position.y = cameraTarget.y + cameraDistance * Math.cos(cameraPhi);
    window._threeCamera.position.z = cameraTarget.z + cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    window._threeCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);

    // Update YAGA.camera
    if (!window.YAGA) {
        window.YAGA = {};
    }
    if (!window.YAGA.camera) {
        window.YAGA.camera = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 0.5, z: 0 }
        };
    }

    // Update position
    window.YAGA.camera.position.x = window._threeCamera.position.x;
    window.YAGA.camera.position.y = window._threeCamera.position.y;
    window.YAGA.camera.position.z = window._threeCamera.position.z;

    // Update target
    window.YAGA.camera.target.x = cameraTarget.x;
    window.YAGA.camera.target.y = cameraTarget.y;
    window.YAGA.camera.target.z = cameraTarget.z;

    // Update rotation
    const euler = new THREE.Euler().setFromQuaternion(window._threeCamera.quaternion);
    window.YAGA.camera.rotation.x = euler.x;
    window.YAGA.camera.rotation.y = euler.y;
    window.YAGA.camera.rotation.z = euler.z;

    // === Shadow opacity depends on the distance ===
    if (initialCameraState && shadowPlaneRef && shadowPlaneRef.material) {
        // Distance between current and initial position
        const pos = window._threeCamera.position;
        const initPos = initialCameraState.position;
        const dist = Math.sqrt(
            Math.pow(pos.x - initPos.x, 2) +
            Math.pow(pos.y - initPos.y, 2) +
            Math.pow(pos.z - initPos.z, 2)
        );
        // We can add the angle consideration (through quaternion)
        const tempCamera = new THREE.PerspectiveCamera();
        tempCamera.position.copy(initialCameraState.position);
        tempCamera.lookAt(initialCameraState.target);
        const initQuat = tempCamera.quaternion.clone();
        const quatDot = Math.abs(window._threeCamera.quaternion.dot(initQuat));
        const angleDiff = Math.acos(Math.min(1, quatDot)) / Math.PI; // normalized angle difference

        // Normalize the distance (0 — matches, 1 — far)
        const norm = Math.min(1, dist / 1.5 + angleDiff); // 1.5 — maximum distance for complete disappearance

        // Interpolate opacity
        const minOpacity = 0.0, maxOpacity = 0.2;
        shadowPlaneRef.material.opacity = maxOpacity * (1 - norm) + minOpacity * norm;
    }
}

// Load initial camera state from localStorage or use defaults
function loadInitialCameraState() {
    try {
        const savedState = localStorage.getItem('initialCameraState');
        if (savedState) {
            const state = JSON.parse(savedState);
            initialCameraState = {
                position: new THREE.Vector3(state.position.x, state.position.y, state.position.z),
                target: new THREE.Vector3(state.target.x, state.target.y, state.target.z),
                distance: state.distance,
                phi: state.phi,
                theta: state.theta
            };
        }
    } catch (e) {
        console.warn('Error loading initial camera state:', e);
    }
}

function saveInitialCameraState() {
    if (!initialCameraState) {
        initialCameraState = {
            position: window._threeCamera.position.clone(),
            target: new THREE.Vector3(cameraTarget.x, cameraTarget.y, cameraTarget.z),
            distance: cameraDistance,
            phi: cameraPhi,
            theta: cameraTheta
        };
        // Save to localStorage
        try {
            localStorage.setItem('initialCameraState', JSON.stringify({
                position: {
                    x: initialCameraState.position.x,
                    y: initialCameraState.position.y,
                    z: initialCameraState.position.z
                },
                target: {
                    x: initialCameraState.target.x,
                    y: initialCameraState.target.y,
                    z: initialCameraState.target.z
                },
                distance: initialCameraState.distance,
                phi: initialCameraState.phi,
                theta: initialCameraState.theta
            }));
        } catch (e) {
            console.warn('Error saving initial camera state:', e);
        }
    }
}

function checkAndSnapCamera() {
    if (!initialCameraState || !shouldCheckSnap) return;

    // Create a temporary camera to get initial quaternion
    const tempCamera = new THREE.PerspectiveCamera();
    tempCamera.position.copy(initialCameraState.position);
    tempCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
    const initQuaternion = tempCamera.quaternion.clone();
    
    // Get current position and quaternion
    const currentPos = window._threeCamera.position;
    const currentQuat = window._threeCamera.quaternion;
    
    // Check if all position values are close to initial
    const posXClose = Math.abs(currentPos.x - initialCameraState.position.x) < SNAP_THRESHOLD;
    const posYClose = Math.abs(currentPos.y - initialCameraState.position.y) < SNAP_THRESHOLD;
    const posZClose = Math.abs(currentPos.z - initialCameraState.position.z) < SNAP_THRESHOLD;
    
    // Check if quaternions are close (dot product close to 1 means they're pointing in same direction)
    const quatDot = Math.abs(currentQuat.dot(initQuaternion));
    const quatClose = quatDot > 0.99; // This is roughly equivalent to about 8 degrees difference

    // If camera is in initial state, reset snap
    if (posXClose && posYClose && posZClose && quatClose) {
        // Stop inertia when snapping begins
        if (!isSnapping) {
            isSnapping = true;
            snapProgress = 0;
            isInertiaActive = false;
            cameraInertia.x = 0;
            cameraInertia.y = 0;
        }

        // Update snap progress
        snapProgress += 0.1; // Increased from 0.02 to 0.05 for faster snapping
        if (snapProgress > 1) snapProgress = 1;

        // Calculate eased interpolation factor
        const easedFactor = easeInOutCubic(snapProgress);

        // Direct position setting with eased interpolation
        window._threeCamera.position.set(
            currentPos.x + (initialCameraState.position.x - currentPos.x) * easedFactor,
            currentPos.y + (initialCameraState.position.y - currentPos.y) * easedFactor,
            currentPos.z + (initialCameraState.position.z - currentPos.z) * easedFactor
        );
        
        // Direct target setting with eased interpolation
        cameraTarget.x += (initialCameraState.target.x - cameraTarget.x) * easedFactor;
        cameraTarget.y += (initialCameraState.target.y - cameraTarget.y) * easedFactor;
        cameraTarget.z += (initialCameraState.target.z - cameraTarget.z) * easedFactor;
        
        // Direct distance setting with eased interpolation
        cameraDistance += (initialCameraState.distance - cameraDistance) * easedFactor;
        
        // Direct quaternion interpolation with easing
        window._threeCamera.quaternion.slerp(initQuaternion, easedFactor);
        
        // Force update camera and ensure it's looking at target
        window._threeCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
        
        // Update YAGA camera state
        if (window.YAGA && window.YAGA.camera) {
            window.YAGA.camera.position.x = window._threeCamera.position.x;
            window.YAGA.camera.position.y = window._threeCamera.position.y;
            window.YAGA.camera.position.z = window._threeCamera.position.z;
            
            const euler = new THREE.Euler().setFromQuaternion(window._threeCamera.quaternion);
            window.YAGA.camera.rotation.x = euler.x;
            window.YAGA.camera.rotation.y = euler.y;
            window.YAGA.camera.rotation.z = euler.z;
            
            window.YAGA.camera.target.x = cameraTarget.x;
            window.YAGA.camera.target.y = cameraTarget.y;
            window.YAGA.camera.target.z = cameraTarget.z;
        }

        // Reset snapping state when complete
        if (snapProgress >= 1) {
            isSnapping = false;
            shouldCheckSnap = false;
        }
    } else {
        isSnapping = false;
        shouldCheckSnap = false;
    }
}

function updateCameraWithInertia() {
    if (!isInertiaActive) return;

    // Apply inertia to camera angles
    cameraTheta += cameraInertia.x;
    cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + cameraInertia.y));
    
    // Decay inertia
    cameraInertia.x *= INERTIA_DECAY;
    cameraInertia.y *= INERTIA_DECAY;
    
    // Stop inertia when it becomes too small
    if (Math.abs(cameraInertia.x) < 0.0001 && Math.abs(cameraInertia.y) < 0.0001) {
        isInertiaActive = false;
    }
    
    updateCameraPosition();
}

function initScene() {
    // Create Three.js scene if it doesn't exist
    if (!window._threeScene) {
        // Get main canvas
        const mainCanvas = document.getElementById('xr-canvas');
        if (!mainCanvas) {
            // ignore
            return;
        }

        // Create scene
        window._threeScene = new THREE.Scene();
        
        // Add raycaster for touch/click detection
        window._raycaster = new THREE.Raycaster();
        window._mouse = new THREE.Vector2();
        
        // Store original materials for meshes
        window._originalMaterials = new Map();
        
        // Create renderer
        var rendererOptions = Object.create(null);
        rendererOptions.alpha = true;
        rendererOptions.antialias = true;
        window._threeRenderer = new THREE.WebGLRenderer(rendererOptions);
        
        // Enable shadows
        window._threeRenderer.shadowMap.enabled = true;
        window._threeRenderer.shadowMap.type = THREE.VSMShadowMap;
        
        // Set Three.js canvas size to match main canvas
        window._threeRenderer.setSize(mainCanvas.width, mainCanvas.height);
        window._threeRenderer.setClearColor(0x000000, 0);
        
        // Style the canvas to match main canvas
        var canvas = window._threeRenderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '2';
        
        // Add renderer to DOM
        document.body.appendChild(canvas);

        // Add touch/click event listeners to Three.js canvas
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        
        // Get canvas size
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
        window._threeCamera.lookAt(0, 0.5, 0);  // Look at point slightly above floor level
        
        // Initialize orbital camera parameters
        const pos = window._threeCamera.position;
        cameraDistance = Math.sqrt(pos.x * pos.x + (pos.y - 0.5) * (pos.y - 0.5) + pos.z * pos.z); // Adjust for target height
        cameraPhi = Math.acos((pos.y - 0.5) / cameraDistance); // Adjust for target height
        cameraTheta = Math.atan2(pos.z, pos.x);
        cameraTarget = { x: 0, y: 0.5, z: 0 };  // Set target point slightly above floor level

        // Set initial camera state directly
        initialCameraState = {
            position: new THREE.Vector3(0, 1, 2),  // Exact same values as camera position
            target: new THREE.Vector3(0, 0.5, 0),  // Exact same values as camera target
            distance: cameraDistance,
            phi: cameraPhi,
            theta: cameraTheta
        };

        // Save to localStorage
        try {
            localStorage.setItem('initialCameraState', JSON.stringify({
                position: {
                    x: initialCameraState.position.x,
                    y: initialCameraState.position.y,
                    z: initialCameraState.position.z
                },
                target: {
                    x: initialCameraState.target.x,
                    y: initialCameraState.target.y,
                    z: initialCameraState.target.z
                },
                distance: initialCameraState.distance,
                phi: initialCameraState.phi,
                theta: initialCameraState.theta
            }));
        } catch (e) {
            console.warn('Error saving initial camera state:', e);
        }

        // === UI for camera transformations ===
        const ui = document.createElement('div');
        ui.style.width = '18rem';
        ui.style.border = 'none';
        ui.style.borderRadius = '0.5rem';

        const title = document.createElement('div');
        title.style.display = 'flex';
        title.style.justifyContent = 'space-between';
        title.style.alignItems = 'center';
        title.style.marginBottom = '0.5rem';
        
        const cameraTitleText = document.createElement('span');
        cameraTitleText.textContent = 'Camera (YAGA.camera)';
        title.appendChild(cameraTitleText);

        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.padding = '0.25rem 0.5rem';
        copyButton.style.borderRadius = '0.25rem';
        copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
        copyButton.style.border = 'none';
        copyButton.style.cursor = 'pointer';
        copyButton.style.fontSize = '1rem';
        copyButton.onclick = (e) => {
            e.stopPropagation();
            const text = `Translate: ${window._threeCamera.position.x.toFixed(2)} ${window._threeCamera.position.y.toFixed(2)} ${window._threeCamera.position.z.toFixed(2)}\nRotate: ${(cameraPhi * 180 / Math.PI).toFixed(2)}° ${(cameraTheta * 180 / Math.PI).toFixed(2)}°\n\nInitial State:\n  Pos: ${initialCameraState.position.x.toFixed(2)} ${initialCameraState.position.y.toFixed(2)} ${initialCameraState.position.z.toFixed(2)}\n  Rot: ${(initialCameraState.phi * 180 / Math.PI).toFixed(2)}° ${(initialCameraState.theta * 180 / Math.PI).toFixed(2)}°`;
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                copyButton.style.backgroundColor = 'rgba(0,255,0,0.2)';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                copyButton.textContent = 'Error!';
                copyButton.style.backgroundColor = 'rgba(255,0,0,0.2)';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                    copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }, 1000);
            });
        };
        title.appendChild(copyButton);
        ui.appendChild(title);

        const translate = document.createElement('div');
        translate.style.marginBottom = '0.5rem';
        translate.style.display = 'flex';
        translate.style.gap = '0.5rem';
        translate.style.alignItems = 'center';

        const translateLabel = document.createElement('span');
        translateLabel.textContent = 'Translate:';
        translate.appendChild(translateLabel);

        const posX = document.createElement('div');
        posX.style.flex = '1';
        posX.style.textAlign = 'center';
        posX.style.padding = '0.25rem';
        posX.style.backgroundColor = 'rgba(255,255,255,0.1)';
        posX.style.borderRadius = '0.25rem';
        translate.appendChild(posX);

        const posY = document.createElement('div');
        posY.style.flex = '1';
        posY.style.textAlign = 'center';
        posY.style.padding = '0.25rem';
        posY.style.backgroundColor = 'rgba(255,255,255,0.1)';
        posY.style.borderRadius = '0.25rem';
        translate.appendChild(posY);

        const posZ = document.createElement('div');
        posZ.style.flex = '1';
        posZ.style.textAlign = 'center';
        posZ.style.padding = '0.25rem';
        posZ.style.backgroundColor = 'rgba(255,255,255,0.1)';
        posZ.style.borderRadius = '0.25rem';
        translate.appendChild(posZ);

        ui.appendChild(translate);

        const rotate = document.createElement('div');
        rotate.style.marginBottom = '0.5rem';
        rotate.style.display = 'flex';
        rotate.style.gap = '0.5rem';
        rotate.style.alignItems = 'center';

        const rotateLabel = document.createElement('span');
        rotateLabel.textContent = 'Rotate:';
        rotate.appendChild(rotateLabel);

        const rotX = document.createElement('div');
        rotX.style.flex = '1';
        rotX.style.textAlign = 'center';
        rotX.style.padding = '0.25rem';
        rotX.style.backgroundColor = 'rgba(255,255,255,0.1)';
        rotX.style.borderRadius = '0.25rem';
        rotate.appendChild(rotX);

        const rotY = document.createElement('div');
        rotY.style.flex = '1';
        rotY.style.textAlign = 'center';
        rotY.style.padding = '0.25rem';
        rotY.style.backgroundColor = 'rgba(255,255,255,0.1)';
        rotY.style.borderRadius = '0.25rem';
        rotate.appendChild(rotY);

        const rotZ = document.createElement('div');
        rotZ.style.flex = '1';
        rotZ.style.textAlign = 'center';
        rotZ.style.padding = '0.25rem';
        rotZ.style.backgroundColor = 'rgba(255,255,255,0.1)';
        rotZ.style.borderRadius = '0.25rem';
        rotate.appendChild(rotZ);

        ui.appendChild(rotate);

        // Add spherical coordinates display
        const spherical = document.createElement('div');
        spherical.style.marginBottom = '0.5rem';
        spherical.style.display = 'flex';
        spherical.style.gap = '0.5rem';
        spherical.style.alignItems = 'center';

        const sphericalLabel = document.createElement('span');
        sphericalLabel.textContent = 'Spherical:';
        spherical.appendChild(sphericalLabel);

        const distance = document.createElement('div');
        distance.style.flex = '1';
        distance.style.textAlign = 'center';
        distance.style.padding = '0.25rem';
        distance.style.backgroundColor = 'rgba(255,255,255,0.1)';
        distance.style.borderRadius = '0.25rem';
        spherical.appendChild(distance);

        const theta = document.createElement('div');
        theta.style.flex = '1';
        theta.style.textAlign = 'center';
        theta.style.padding = '0.25rem';
        theta.style.backgroundColor = 'rgba(255,255,255,0.1)';
        theta.style.borderRadius = '0.25rem';
        spherical.appendChild(theta);

        const phi = document.createElement('div');
        phi.style.flex = '1';
        phi.style.textAlign = 'center';
        phi.style.padding = '0.25rem';
        phi.style.backgroundColor = 'rgba(255,255,255,0.1)';
        phi.style.borderRadius = '0.25rem';
        spherical.appendChild(phi);

        ui.appendChild(spherical);

        // Add initial camera state display
        const initialState = document.createElement('div');
        initialState.style.marginBottom = '0.5rem';
        initialState.style.opacity = '0.7';
        initialState.textContent = 'Initial State: Loading...';
        ui.appendChild(initialState);

        // Prevent panel dragging when selecting text
        ui.addEventListener('mousedown', function(e) {
            if (e.target === initialState || initialState.contains(e.target)) {
                e.stopPropagation();  // Prevent panel drag when selecting text
            }
        });

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

        const lightsTitleText = document.createElement('span');
        lightsTitleText.textContent = 'Lights';

        lightsTitle.appendChild(lightsTitleText);
        window.lightsUI.appendChild(lightsTitle);

        // Add visibility handle section
        const visibilityHandle = document.createElement('div');
        visibilityHandle.style.display = 'flex';
        visibilityHandle.style.alignItems = 'center';
        visibilityHandle.style.justifyContent = 'space-between';
        visibilityHandle.style.marginBottom = '0.5rem';

        const handleLabel = document.createElement('span');
        handleLabel.textContent = 'Visible handle';

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
        visibilityHandle.appendChild(handleLabel);
        visibilityHandle.appendChild(toggleAllSwitch);
        window.lightsUI.appendChild(visibilityHandle);

        window.lightsInfo = document.createElement('div');
        window.lightsUI.appendChild(window.lightsInfo);

        // Storage for helpers and their toggles
        window.lightHelpers = new Map();

        // Function to create a toggle for an individual light
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

            // Save helper and its toggle
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

        const gridTitle = document.createElement('div');
        gridTitle.style.display = 'flex';
        gridTitle.style.alignItems = 'center';
        gridTitle.style.justifyContent = 'space-between';

        const gridTitleText = document.createElement('span');
        gridTitleText.textContent = 'Grid';

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
        // Load state from localStorage or default to true
        window.gridToggleInput.checked = localStorage.getItem('showGrid') !== 'false';

        const gridSlider = document.createElement('span');
        gridSlider.style.position = 'absolute';
        gridSlider.style.cursor = 'pointer';
        gridSlider.style.top = '0';
        gridSlider.style.left = '0';
        gridSlider.style.right = '0';
        gridSlider.style.bottom = '0';
        gridSlider.style.backgroundColor = window.gridToggleInput.checked ? '#007AFF' : '#ccc';
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
        gridKnob.style.transform = window.gridToggleInput.checked ? 'translateX(1.75rem)' : 'translateX(0)';

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
            // Save state to localStorage
            localStorage.setItem('showGrid', window.gridToggleInput.checked);
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
            
            // Update position values
            posX.textContent = cam.position.x.toFixed(2);
            posY.textContent = cam.position.y.toFixed(2);
            posZ.textContent = cam.position.z.toFixed(2);
            
            // Get Euler angles from camera quaternion
            const euler = new THREE.Euler().setFromQuaternion(cam.quaternion);
            const eulerX = euler.x * 180 / Math.PI;
            const eulerY = euler.y * 180 / Math.PI;
            const eulerZ = euler.z * 180 / Math.PI;
            
            // Update rotation values
            rotX.textContent = `${eulerX.toFixed(2)}°`;
            rotY.textContent = `${eulerY.toFixed(2)}°`;
            rotZ.textContent = `${eulerZ.toFixed(2)}°`;

            // Update spherical coordinates
            distance.textContent = `d: ${cameraDistance.toFixed(2)}`;
            theta.textContent = `θ: ${(cameraTheta * 180 / Math.PI).toFixed(2)}°`;
            phi.textContent = `φ: ${(cameraPhi * 180 / Math.PI).toFixed(2)}°`;

            // Update initial state display and highlight values
            if (initialCameraState) {
                const initPos = initialCameraState.position;
                
                // Create a temporary camera to get Euler angles
                const tempCamera = new THREE.PerspectiveCamera();
                tempCamera.position.copy(initPos);
                tempCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
                
                const initEuler = new THREE.Euler().setFromQuaternion(tempCamera.quaternion);
                const initEulerX = initEuler.x * 180 / Math.PI;
                const initEulerY = initEuler.y * 180 / Math.PI;
                const initEulerZ = initEuler.z * 180 / Math.PI;

                // Highlight position values
                const posDiff = Math.abs(cam.position.x - initPos.x);
                posX.style.backgroundColor = posDiff < SNAP_THRESHOLD ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';
                
                const posYDiff = Math.abs(cam.position.y - initPos.y);
                posY.style.backgroundColor = posYDiff < SNAP_THRESHOLD ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';
                
                const posZDiff = Math.abs(cam.position.z - initPos.z);
                posZ.style.backgroundColor = posZDiff < SNAP_THRESHOLD ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';

                // Highlight rotation values
                const rotXDiff = Math.abs(eulerX - initEulerX);
                rotX.style.backgroundColor = rotXDiff < SNAP_ANGLE_THRESHOLD * 180 / Math.PI ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';
                
                const rotYDiff = Math.abs(eulerY - initEulerY);
                rotY.style.backgroundColor = rotYDiff < SNAP_ANGLE_THRESHOLD * 180 / Math.PI ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';
                
                const rotZDiff = Math.abs(eulerZ - initEulerZ);
                rotZ.style.backgroundColor = rotZDiff < SNAP_ANGLE_THRESHOLD * 180 / Math.PI ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)';
                
                initialState.textContent = `Initial State:\n  Pos: ${initPos.x.toFixed(2)} ${initPos.y.toFixed(2)} ${initPos.z.toFixed(2)}\n  Rot: ${initEulerX.toFixed(2)}° ${initEulerY.toFixed(2)}° ${initEulerZ.toFixed(2)}°`;
            }

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
        window.gridHelper.visible = window.gridToggleInput.checked;
        window._threeScene.add(window.gridHelper);
        
        // Add axes helper
        window.axesHelper = new THREE.AxesHelper(0.2);
        window.axesHelper.visible = window.gridToggleInput.checked;
        window._threeScene.add(window.axesHelper);
        
        // Add hemisphere light
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x3b3b3a, 2.5);
        hemisphereLight.position.set(0, 1, 0);
        window._threeScene.add(hemisphereLight);


        // Add directional light for shadows (softer for cloudy day)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(3, 10, 0); // Changed to be directly above
        directionalLight.castShadow = true;
        
        // Configure shadow properties for cloudy day
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        
        // Add shadow blur for cloudy day
        directionalLight.shadow.radius = 15;
        directionalLight.shadow.bias = -0.0001;
        directionalLight.shadow.normalBias = 0.02;
        // directionalLight.shadow.blurSamples = 25;
        
        window._threeScene.add(directionalLight);

        // Add shadow plane with softer shadow
        const shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.ShadowMaterial({ 
                opacity: 0.2,
                transparent: true,
                depthWrite: false
            })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.01; // Slightly above ground to prevent z-fighting
        shadowPlane.receiveShadow = true;
        window._threeScene.add(shadowPlane);
        // === Save reference to shadow plane for fade ===
        shadowPlaneRef = shadowPlane;
        
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
            sprite.visible = window.gridToggleInput.checked;  // Set initial visibility

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
                
                // Store last mouse movement for inertia
                lastMouseDelta.x = deltaMove.x * 0.01;
                lastMouseDelta.y = -deltaMove.y * 0.01;
                
                // Update angles (inverted rotation)
                cameraTheta += lastMouseDelta.x;
                cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + lastMouseDelta.y));
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
                if (!isDragging) { // Only check for snap if we're not dragging
                    shouldCheckSnap = true;
                }
            } else if (e.button === 0) {
                isDragging = false;
                // Start inertia with last mouse movement
                if (Math.abs(lastMouseDelta.x) > 0.001 || Math.abs(lastMouseDelta.y) > 0.001) {
                    cameraInertia.x = lastMouseDelta.x;
                    cameraInertia.y = lastMouseDelta.y;
                    isInertiaActive = true;
                    shouldCheckSnap = true; // Enable snap checking during inertia
                } else {
                    shouldCheckSnap = true;
                }
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
            if (isSnapping) return; // Block camera control during snapping
            
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
        canvas.addEventListener('touchstart', function(event) {
            event.preventDefault();
            if (event.touches.length === 1) {
                isDragging = true;
                lastMouseX = event.touches[0].clientX;
                lastMouseY = event.touches[0].clientY;
            } else if (event.touches.length === 2) {
                // Store initial touch positions for rotation
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx*dx + dy*dy);
                lastTouchCenter = {
                    x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
                    y: (event.touches[0].clientY + event.touches[1].clientY) / 2
                };
                panTargetStartTouch.x = cameraTarget.x;
                panTargetStartTouch.y = cameraTarget.y;
                panTargetStartTouch.z = cameraTarget.z;
            }
        }, { passive: false });
        canvas.addEventListener('touchmove', function(event) {
            event.preventDefault();
            if (event.touches.length === 1 && isDragging) {
                var touch = event.touches[0];
                var deltaX = touch.clientX - lastMouseX;
                var deltaY = touch.clientY - lastMouseY;

                // Pan camera target
                var panSpeed = cameraDistance * 0.002;
                var camera = window._threeCamera;
                camera.updateMatrixWorld();
                var right = new THREE.Vector3();
                var up = new THREE.Vector3();
                camera.getWorldDirection(right); // forward
                right.crossVectors(camera.up, right).normalize(); // right = up x forward
                up.copy(camera.up).normalize();
                cameraTarget.x += deltaX * panSpeed * right.x + deltaY * panSpeed * up.x;
                cameraTarget.y += deltaX * panSpeed * right.y + deltaY * panSpeed * up.y;
                cameraTarget.z += deltaX * panSpeed * right.z + deltaY * panSpeed * up.z;
                updateCameraPosition();

                lastMouseX = touch.clientX;
                lastMouseY = touch.clientY;
            } else if (event.touches.length === 2) {
                // Two-finger rotation
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                const newDist = Math.sqrt(dx*dx + dy*dy);
                
                // Calculate rotation based on touch movement
                const newCenter = {
                    x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
                    y: (event.touches[0].clientY + event.touches[1].clientY) / 2
                };
                
                // Update camera angles based on touch movement
                const deltaX = newCenter.x - lastTouchCenter.x;
                const deltaY = newCenter.y - lastTouchCenter.y;
                
                cameraTheta += deltaX * 0.01;
                cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi - deltaY * 0.01));
                
                updateCameraPosition();
                
                // Update last touch positions
                lastTouchCenter = newCenter;
                lastTouchDist = newDist;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function(event) {
            event.preventDefault();
            if (event.touches.length === 0) {
                isDragging = false;
                lastTouchDist = null;
                lastTouchCenter = null;
                checkAndSnapCamera(); // Check for snap after touch interaction
            }
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

        // Add touch event listeners to Three.js canvas
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });

        var renderStage = Object.create(null);
        renderStage.render = function(gl) {
            // Render Three.js scene
            window._threeRenderer.render(window._threeScene, window._threeCamera);
        };

        // Start animation loop
        function animate() {
            requestAnimationFrame(animate);
            // === Update animations ===
            if (window._threeAnimationMixers) {
                var delta = window._threeRenderer.clock ? window._threeRenderer.clock.getDelta() : 0.016;
                window._threeAnimationMixers.forEach(mixer => mixer.update(delta));
            }
            
            // Update camera with inertia
            updateCameraWithInertia();
            
            // Always check for snap, even during inertia
            checkAndSnapCamera();
            
            window._threeRenderer.render(window._threeScene, window._threeCamera);
        }
        // Clock for animations
        window._threeRenderer.clock = new THREE.Clock();
        animate();

        // After scene and renderer are set up:
        loadGLTFLoader(function() {
            addCharacterModel(window._threeScene);
        });

        updateSceneFromTracking();
    }
}

// === Global variables for virtual tracker ===
let greenX = 0, greenY = 0;
let offsets = [];
let isFirstGreen = true;

function updateSceneFromTracking() {
    if (window.Module && window.Module._getTrackingPoints && window.Module.HEAPF32) {
        try {
            const canvas = window._threeRenderer && window._threeRenderer.domElement;
            if (!canvas) return;

            const pointsPtr = window.Module._getTrackingPoints();
            const count = window.Module._getTrackingPointsCount();
            if (count > 0 && pointsPtr) {
                const points = new Float32Array(window.Module.HEAPF32.buffer, pointsPtr, count * 3);
                let avgX = 0, avgY = 0, stableCount = 0;
                let stablePoints = [];
                for (let i = 0; i < count; i++) {
                    const isStable = points[i * 3 + 2];
                    if (isStable) {
                        stablePoints.push({x: points[i * 3], y: points[i * 3 + 1]});
                        avgX += points[i * 3];
                        avgY += points[i * 3 + 1];
                        stableCount++;
                    }
                }

                if (stableCount > 0) {
                    avgX /= stableCount;
                    avgY /= stableCount;

                    if (isFirstGreen) {
                        greenX = 0;
                        greenY = 0;
                        offsets = stablePoints.map(pt => ({dx: pt.x - greenX, dy: pt.y - greenY}));
                        isFirstGreen = false;
                    } else {
                        if (stablePoints.length === offsets.length) {
                            let sumX = 0, sumY = 0;
                            for (let i = 0; i < stablePoints.length; i++) {
                                sumX += stablePoints[i].x - offsets[i].dx;
                                sumY += stablePoints[i].y - offsets[i].dy;
                            }
                            greenX = sumX / stablePoints.length;
                            greenY = sumY / stablePoints.length;
                        } else {
                            offsets = stablePoints.map(pt => ({dx: pt.x - greenX, dy: pt.y - greenY}));
                        }
                    }

                    // Bind canvas to the green point
                    const screenX = (greenX + 1) * canvas.width / 2;
                    const screenY = (-greenY + 1) * canvas.height / 2;
                    canvas.style.position = 'fixed';
                    canvas.style.left = '0';
                    canvas.style.top = '0';
                    canvas.style.transform = `translate(${screenX - canvas.width / 2}px, ${screenY - canvas.height / 2}px)`;
                }
            }
        } catch (e) {
            // ignore
        }
    }
    requestAnimationFrame(updateSceneFromTracking);
}

function waitForRendererAndTrack() {
    if (window._threeRenderer && window._threeRenderer.domElement) {
        updateSceneFromTracking();
    } else {
        setTimeout(waitForRendererAndTrack, 50);
    }
}
waitForRendererAndTrack();

// Add character model function
function addCharacterModel(scene) {
    const loader = new THREE.GLTFLoader();
    loader.load('sky_character.glb', function(gltf) {
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        
        // Enable shadows for all meshes in the model
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        
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

// Handle touch events
function onTouchStart(event) {
    event.preventDefault();
    
    // Get touch position
    const touch = event.touches[0];
    const rect = event.target.getBoundingClientRect();
    window._mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    window._mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Check if touch hit a mesh
    window._raycaster.setFromCamera(window._mouse, window._threeCamera);
    const intersects = window._raycaster.intersectObjects(window._threeScene.children, true);
    const meshIntersects = intersects.filter(intersect => intersect.object.isMesh);
    
    if (meshIntersects.length > 0) {
        // Touch hit a mesh - handle scene movement
        const mesh = meshIntersects[0].object;
        
        // Store initial touch position and camera target
        panStart = {
            x: touch.clientX,
            y: touch.clientY
        };
        panTargetStart = {
            x: cameraTarget.x,
            y: cameraTarget.y,
            z: cameraTarget.z
        };
        
        // Enable panning
        isPanning = true;
        
        // Prevent default camera rotation behavior
        event.stopPropagation();
    } else {
        // Touch hit empty space - handle scene rotation
        // Store initial touch position
        previousMousePosition = {
            x: touch.clientX,
            y: touch.clientY
        };
        
        // Enable dragging for camera rotation
        isDragging = true;
    }
}

// Handle touch move
function onTouchMove(event) {
    const touch = event.touches[0];
    
    if (isPanning) {
        // Handle scene movement
        const dx = touch.clientX - panStart.x;
        const dy = touch.clientY - panStart.y;
        const panSpeed = cameraDistance * 0.002;
        
        // Get camera's right and up vectors
        const camera = window._threeCamera;
        camera.updateMatrixWorld();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.getWorldDirection(right); // forward
        right.crossVectors(camera.up, right).normalize(); // right = up x forward
        up.copy(camera.up).normalize();
        
        // Update camera target position
        cameraTarget.x = panTargetStart.x + dx * panSpeed * right.x + dy * panSpeed * up.x;
        cameraTarget.y = panTargetStart.y + dx * panSpeed * right.y + dy * panSpeed * up.y;
        cameraTarget.z = panTargetStart.z + dx * panSpeed * right.z + dy * panSpeed * up.z;
        
        updateCameraPosition();
    } else if (isDragging) {
        // Handle scene rotation
        const deltaMove = {
            x: touch.clientX - previousMousePosition.x,
            y: touch.clientY - previousMousePosition.y
        };
        
        // Update camera angles based on touch movement
        cameraTheta += deltaMove.x * 0.01;
        cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi - deltaMove.y * 0.01));
        
        // Update camera position
        updateCameraPosition();
        
        // Update last touch position
        previousMousePosition = {
            x: touch.clientX,
            y: touch.clientY
        };
    }
}

// Handle touch end
function onTouchEnd(event) {
    isDragging = false;
    isPanning = false;
    previousMousePosition = { x: 0, y: 0 };
    checkAndSnapCamera(); // Check for snap after touch interaction
}
