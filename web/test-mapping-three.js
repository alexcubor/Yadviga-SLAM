// Camera frustum visualizer initialization

// Load GLTFLoader if not already loaded
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

// Simple list of model files
const modelFiles = [
    'camera.glb',
    'phone.glb', 
    'glasses.glb',
    'hairdryer.glb',
    'headset.glb'
];

// Global variables for switching between models
let currentModelIndex = 0; // Index in the models array
let models = []; // Array of all available models (will be populated lazily)
let currentActiveModel = null;
let loadedModels = new Map(); // Track which models are loaded

// Hover effect variables
let hoveredModel = null;
let originalMaterials = new Map(); // Store original materials for each model
let hoverMaterials = new Map(); // Store hover materials for each model
let tooltipElement = null; // Tooltip element for hover hints

// Dynamic model configuration generator
function generateModelConfig(index) {
    const fileName = modelFiles[index];
    const modelName = fileName ? fileName.replace('.glb', '').replace(/^\w/, c => c.toUpperCase()) : `Model${index}`;
    
    return {
        name: modelName,
        glbPath: `models/${modelFiles[index]}`,
        position: { x: 0, y: 1.5, z: 2 },
        rotation: { x: 0, y: index === 0 ? Math.PI : 0, z: 0 }, // Camera needs rotation
        scale: { x: 1, y: 1, z: 1 },
        fallbackGeometry: (group) => createFallbackGeometry(group, modelName)
    };
}

// Dynamic geometry generator
function generateGeometryConfig(modelName) {
    const baseSize = 0.1; // Base size for all models
    
    return {
        material: { color: 0x888888, shininess: 50 },
        type: 'sphere',
        params: { 
            radius: baseSize,
            widthSegments: 16,
            heightSegments: 12
        }
    };
}

// Material factory for creating different types of materials
function createMaterial(materialProps) {
    const defaultProps = {
        color: 0x888888,
        shininess: 50,
        transparent: false,
        opacity: 1.0,
        metalness: 0.0,
        roughness: 0.5
    };
    
    const props = { ...defaultProps, ...materialProps };
    
    // Choose material type based on properties
    if (props.metalness > 0 || props.roughness !== 0.5) {
        // Use MeshStandardMaterial for PBR materials
        return new THREE.MeshStandardMaterial({
            color: props.color,
            metalness: props.metalness,
            roughness: props.roughness,
            transparent: props.transparent,
            opacity: props.opacity
        });
    } else {
        // Use MeshPhongMaterial for traditional materials
        return new THREE.MeshPhongMaterial({
            color: props.color,
            shininess: props.shininess,
            transparent: props.transparent,
            opacity: props.opacity
        });
    }
}

// Universal fallback geometry creation function with dynamic generation
function createFallbackGeometry(group, modelName) {
    const config = generateGeometryConfig(modelName);
    if (!config) {
        console.warn(`[test-mapping] No geometry config for ${modelName}`);
        return;
    }
    
    // Create one material for the model
    const material = createMaterial(config.material);
    
    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(
        config.params.radius,
        config.params.widthSegments,
        config.params.heightSegments
    );
    
    // Create mesh with shared material
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add to group
    group.add(mesh);
    
    // Calculate bounding box and auto-scale
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetSize = 0.2;
    
    if (maxDimension > 0) {
        const scale = targetSize / maxDimension;
        group.scale.set(scale, scale, scale);
    }
    
    // Center the model
    const center = boundingBox.getCenter(new THREE.Vector3());
    group.position.sub(center.multiplyScalar(scale || 1));
}

// Universal model creation function
function createModel(config) {
    const group = new THREE.Group();
    group.position.set(config.position.x, config.position.y, config.position.z);
    group.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    
    // Add to scene immediately
    if (window._threeScene) {
        window._threeScene.add(group);
        
        // Ensure all meshes in the model are raycastable
        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.modelIndex = modelFiles.indexOf(config.glbPath.replace('models/', ''));
            }
        });
    } else {
        console.warn('[test-mapping] Scene not available when creating model');
    }
    
    // Try to load GLB model
    loadGLTFLoader(function() {
        const loader = new THREE.GLTFLoader();
        
        loader.load(config.glbPath, 
            // Success callback
            function(gltf) {
                const model = gltf.scene;
                
                // Apply scale
                model.scale.set(config.scale.x, config.scale.y, config.scale.z);
                
                // Enable shadows for all meshes in the model
                model.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                
                // Clear the placeholder group and add the loaded model
                group.clear();
                group.add(model);
            }, 
            // Progress callback
            function(xhr) {
                // Silent progress
            },
            // Error callback - use simple geometry as fallback
            function(error) {
                console.warn(`[test-mapping] Failed to load ${config.glbPath}:`, error);
                config.fallbackGeometry(group);
            }
        );
    });
    
    return group;
}

function addCameraFrustumWithIMU() {
    if (!window._threeScene) {
        console.error('[test-mapping] No _threeScene for camera frustum');
        return;
    }
    
    if (!window._threeRenderer) {
        console.error('[test-mapping] No _threeRenderer for camera frustum');
        return;
    }
    
    if (!window.Module) {
        console.error('[test-mapping] No Module object for IMU updates');
        return;
    }
    
    // Initialize models array with placeholders
    models = new Array(modelFiles.length);
    
    // Load initial model (Camera)
    loadModel(0).then(() => {
        // Set initial visibility
        updateModelVisibility();
        
        // Add click detection after initial model is loaded
        setupClickDetection();
        
        // Add hover detection after initial model is loaded
        setupHoverDetection();
    });
    
    // Store original updateIMU function
    const originalUpdateIMU = window.Module._updateIMU;
    
    // Performance optimization variables
    let lastUpdateTime = 0;
    const updateInterval = 16; // ~60fps max
    const toRad = Math.PI / 180;
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    
    // Subscribe to sensor updates for model rotation
    window.Module._updateIMU = (wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz) => {
        // Call original function first
        if (originalUpdateIMU) {
            try {
                originalUpdateIMU(wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz);
            } catch (e) {
                console.error('Error in original updateIMU:', e);
            }
        }
        
        // Throttle updates to prevent freezing
        const now = performance.now();
        if (now - lastUpdateTime < updateInterval) {
            return;
        }
        lastUpdateTime = now;
        
        // Apply rotation to active model
        if (currentActiveModel) {
            // Update rotation using existing objects (no new allocations)
            euler.set(
                wy * -toRad,  // pitch (X-axis)
                wx * -toRad,  // yaw (Y-axis)
                wz * -toRad   // roll (Z-axis)
            );
            quaternion.setFromEuler(euler);
            currentActiveModel.quaternion.copy(quaternion);
            
            // Update position based on acceleration (simplified)
            const smoothingFactor = 0.05; // Reduced for better performance
            const maxOffset = 0.5; // Reduced range
            
            // Calculate new position with smoothing
            const newX = currentActiveModel.position.x + ax * smoothingFactor;
            const newY = currentActiveModel.position.y + ay * smoothingFactor;
            const newZ = currentActiveModel.position.z + az * smoothingFactor;
            
            // Apply position with bounds
            currentActiveModel.position.set(
                Math.max(-maxOffset, Math.min(maxOffset, newX)),
                Math.max(-maxOffset, Math.min(maxOffset, newY)),
                Math.max(-maxOffset, Math.min(maxOffset, newZ))
            );
            
            // Only update matrix when necessary (not every frame)
            if (Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1 || Math.abs(az) > 0.1) {
                currentActiveModel.updateMatrix();
                currentActiveModel.updateMatrixWorld();
            }
        }
    };
    
    return { models };
}

// Create hover material for a given material
function createHoverMaterial(originalMaterial) {
    if (originalMaterial.isMeshPhongMaterial) {
        const hoverMaterial = originalMaterial.clone();
        hoverMaterial.emissive.setHex(0x444444); // Add subtle glow
        hoverMaterial.emissiveIntensity = 0.3;
        return hoverMaterial;
    } else if (originalMaterial.isMeshStandardMaterial) {
        const hoverMaterial = originalMaterial.clone();
        hoverMaterial.emissive.setHex(0x444444);
        hoverMaterial.emissiveIntensity = 0.3;
        return hoverMaterial;
    } else if (originalMaterial.isMeshBasicMaterial) {
        const hoverMaterial = originalMaterial.clone();
        hoverMaterial.color.setHex(originalMaterial.color.getHex() + 0x222222);
        return hoverMaterial;
    }
    
    return originalMaterial.clone();
}

// Apply hover effect to a model
function applyHoverEffect(model) {
    if (!model || hoveredModel === model) return;
    
    // Remove hover effect from previously hovered model
    if (hoveredModel) {
        removeHoverEffect(hoveredModel);
    }
    
    hoveredModel = model;
    
    // Apply hover effect to all meshes in the model
    let meshCount = 0;
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            meshCount++;
            // Store original material if not already stored
            if (!originalMaterials.has(child)) {
                originalMaterials.set(child, child.material);
            }
            
            // Create hover material if not already created
            if (!hoverMaterials.has(child)) {
                hoverMaterials.set(child, createHoverMaterial(child.material));
            }
            
            // Apply hover material
            child.material = hoverMaterials.get(child);
        }
    });
}

// Remove hover effect from a model
function removeHoverEffect(model) {
    if (!model) return;
    
    // Restore original materials for all meshes in the model
    let meshCount = 0;
    model.traverse((child) => {
        if (child.isMesh && originalMaterials.has(child)) {
            meshCount++;
            child.material = originalMaterials.get(child);
        }
    });
    
    hoveredModel = null;
}

// Setup hover detection
function setupHoverDetection() {
    const canvas = window._threeRenderer ? window._threeRenderer.domElement : null;
    if (!canvas) {
        return;
    }
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Mouse move event for hover detection
    canvas.addEventListener('mousemove', function(event) {
        // Only check hover on the currently visible model
        if (!currentActiveModel || !currentActiveModel.visible || !currentActiveModel.children || currentActiveModel.children.length === 0) {
            if (hoveredModel) {
                removeHoverEffect(hoveredModel);
            }
            hideTooltip();
            return;
        }
        
        // Calculate mouse position in normalized device coordinates
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, window._threeCamera);
        
        try {
            // Calculate objects intersecting the picking ray (only check current active model)
            const intersects = raycaster.intersectObject(currentActiveModel, true);
            
            if (intersects.length > 0) {
                const hoveredObject = intersects[0].object;
                
                // Check if the hovered object is part of the current active model
                let parentModel = hoveredObject;
                while (parentModel && parentModel !== currentActiveModel) {
                    parentModel = parentModel.parent;
                }
                
                if (parentModel === currentActiveModel && currentActiveModel !== hoveredModel) {
                    applyHoverEffect(currentActiveModel);
                    showTooltip(event, 'Press X');
                }
            } else {
                // No object hovered, remove hover effect
                if (hoveredModel) {
                    removeHoverEffect(hoveredModel);
                }
                hideTooltip();
            }
        } catch (error) {
            // Silently handle raycaster errors
            if (hoveredModel) {
                removeHoverEffect(hoveredModel);
            }
            hideTooltip();
        }
    }, { passive: true });
    
    // Mouse leave event to remove hover effect when mouse leaves canvas
    canvas.addEventListener('mouseleave', function(event) {
        if (hoveredModel) {
            removeHoverEffect(hoveredModel);
        }
        hideTooltip();
    }, { passive: true });
}

function setupClickDetection() {
    // Get the Three.js canvas element
    const canvas = window._threeRenderer ? window._threeRenderer.domElement : null;
    if (!canvas) {
        console.error('[test-mapping] No Three.js canvas found for click detection');
        return;
    }
    
    // Create raycaster for mouse picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Add click event listener with capture to ensure it runs first
    canvas.addEventListener('click', function(event) {
        // Prevent event from bubbling up
        event.stopPropagation();
        
        // Calculate mouse position in normalized device coordinates
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, window._threeCamera);
        
        // Filter out undefined models and only check loaded models
        const loadedModelsArray = models.filter(model => model && model.visible);
        
        if (loadedModelsArray.length === 0) {
            return;
        }
        
        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(loadedModelsArray, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            // Find the parent model in our models array
            let parentModel = clickedObject;
            while (parentModel && !models.includes(parentModel)) {
                parentModel = parentModel.parent;
            }
            
            if (parentModel) {
                // Find the index of the clicked model
                const clickedIndex = models.indexOf(parentModel);
                
                if (clickedIndex !== -1 && clickedIndex !== currentModelIndex) {
                    currentModelIndex = clickedIndex;
                    updateModelVisibility().catch(console.error);
                    
                    const fileName = modelFiles[currentModelIndex];
                    const modelName = fileName ? fileName.replace('.glb', '').replace(/^\w/, c => c.toUpperCase()) : 'Unknown';
                    console.log(`[test-mapping] Switched to ${modelName} model (clicked)`);
                }
            }
        }
    }, true); // Use capture phase
    
    // Also add mousedown event as backup
    canvas.addEventListener('mousedown', function(event) {
        // Silent mousedown detection
    }, true);
}

async function updateModelVisibility() {
    if (models.length > 0) {
        // Hide all loaded models
        models.forEach((model, index) => {
            if (model) {
                model.visible = false;
            }
        });
        
        // Load current model if not loaded
        if (currentModelIndex >= 0 && currentModelIndex < models.length) {
            await ensureCurrentModelLoaded();
            
            // Show only the current model
            if (models[currentModelIndex]) {
                models[currentModelIndex].visible = true;
                currentActiveModel = models[currentModelIndex];
                currentActiveModel.rotation.set(0, Math.PI, 0);
            }
        }
        
        // Hide tooltip when switching models
        hideTooltip();
        if (hoveredModel) {
            removeHoverEffect(hoveredModel);
        }
    } else {
        console.warn('[test-mapping] No models available for visibility update');
    }
}

// Add function to sync camera parameters with test-three.js system
function syncCameraParameters() {
    if (!window.YAGA || !window.YAGA.camera) {
        return;
    }
    
    // Update cameraTarget (this is the global variable in test-three.js)
    if (typeof cameraTarget !== 'undefined') {
        cameraTarget.x = window.YAGA.camera.target.x;
        cameraTarget.y = window.YAGA.camera.target.y;
        cameraTarget.z = window.YAGA.camera.target.z;
    }
    
    // Calculate new spherical coordinates from current position
    const pos = window.YAGA.camera.position;
    const target = window.YAGA.camera.target;
    
    // Calculate relative position from target
    const relX = pos.x - target.x;
    const relY = pos.y - target.y;
    const relZ = pos.z - target.z;
    
    // Calculate distance
    const distance = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
    
    // Calculate spherical angles
    const phi = Math.acos(relY / distance);
    const theta = Math.atan2(relZ, relX);
    
    // Update global camera parameters in test-three.js
    if (typeof cameraDistance !== 'undefined') {
        cameraDistance = distance;
    }
    if (typeof cameraPhi !== 'undefined') {
        cameraPhi = phi;
    }
    if (typeof cameraTheta !== 'undefined') {
        cameraTheta = theta;
    }
}

// Wait for scene to appear with timeout
let sceneCheckAttempts = 0;
const maxAttempts = 100; // 5 seconds at 50ms intervals

function checkForScene() {
    sceneCheckAttempts++;
    
    if (window._threeScene && window._threeRenderer && window.THREE && window.Module) {
        addCameraFrustumWithIMU();
        return;
    }
    
    if (sceneCheckAttempts >= maxAttempts) {
        console.error('[test-mapping] Timeout waiting for scene initialization');
        return;
    }
    
    setTimeout(checkForScene, 50);
}

// Start checking for scene
checkForScene();

// Add keyboard controls for model switching
document.addEventListener('keydown', function(event) {
    if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        if (event.key.toLowerCase() === 'x' || event.key.toLowerCase() === 'ч') {
            event.preventDefault();
            if (models.length > 0) {
                currentModelIndex = (currentModelIndex + 1) % models.length;
                updateModelVisibility().catch(console.error);
            }
        }
    }
});

// Create tooltip element
function createTooltip() {
    if (tooltipElement) {
        tooltipElement.remove();
    }
    
    tooltipElement = document.createElement('div');
    tooltipElement.style.position = 'fixed';
    tooltipElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltipElement.style.color = 'white';
    tooltipElement.style.padding = '8px 12px';
    tooltipElement.style.borderRadius = '6px';
    tooltipElement.style.fontFamily = 'monospace';
    tooltipElement.style.fontSize = '14px';
    tooltipElement.style.fontWeight = 'bold';
    tooltipElement.style.zIndex = '10000';
    tooltipElement.style.pointerEvents = 'none';
    tooltipElement.style.opacity = '0';
    tooltipElement.style.transition = 'opacity 0.2s ease-in-out';
    tooltipElement.style.whiteSpace = 'nowrap';
    tooltipElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    tooltipElement.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

// Show tooltip at mouse position
function showTooltip(event, text) {
    if (!tooltipElement) {
        createTooltip();
    }
    
    tooltipElement.textContent = text;
    tooltipElement.style.left = (event.clientX + 10) + 'px';
    tooltipElement.style.top = (event.clientY - 40) + 'px';
    tooltipElement.style.opacity = '1';
}

// Hide tooltip
function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.opacity = '0';
    }
}

// Lazy model loader
async function loadModel(index) {
    if (loadedModels.has(index)) {
        return loadedModels.get(index);
    }
    
    const config = generateModelConfig(index);
    const model = createModel(config);
    
    // Store the model
    loadedModels.set(index, model);
    
    // Add to models array if not already there
    if (!models[index]) {
        models[index] = model;
    }
    
    return model;
}

// Load current model if not loaded
async function ensureCurrentModelLoaded() {
    if (!loadedModels.has(currentModelIndex)) {
        await loadModel(currentModelIndex);
    }
}
