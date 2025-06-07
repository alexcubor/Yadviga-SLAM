// Enable log for Babylon.js mapping
console.log('🟪 Enable test-mapping-babylon.js');

// Tracking points averaging functions
function calculatePointWeight(point, centerX = 0, centerY = 0) {
    // Distance from center (closer points get higher weight)
    const distanceFromCenter = Math.sqrt(
        Math.pow(point.x - centerX, 2) + 
        Math.pow(point.y - centerY, 2)
    );
    const distanceWeight = Math.exp(-distanceFromCenter); // Exponential decay
    return distanceWeight;
}

function averageTrackingPoints(points) {
    if (!points || points.length === 0) {
        return null;
    }

    // First pass: calculate center of mass
    const center = points.reduce((acc, p) => ({
        x: acc.x + p.x,
        y: acc.y + p.y
    }), {x: 0, y: 0});
    center.x /= points.length;
    center.y /= points.length;

    // Second pass: calculate weighted average
    const weightedSum = points.reduce((acc, p) => {
        const weight = calculatePointWeight(p, center.x, center.y);
        return {
            x: acc.x + p.x * weight,
            y: acc.y + p.y * weight,
            totalWeight: acc.totalWeight + weight
        };
    }, {x: 0, y: 0, totalWeight: 0});

    // Normalize by total weight
    return {
        x: weightedSum.x / weightedSum.totalWeight,
        y: weightedSum.y / weightedSum.totalWeight
    };
}

(function() {
    function loadScript(src, onload) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onload;
        document.head.appendChild(script);
    }

    // Initialize scene immediately
    if (!window.BABYLON) {
        loadScript('https://cdn.babylonjs.com/babylon.js', function() {
            loadScript('https://cdn.babylonjs.com/materialsLibrary/babylon.gridMaterial.min.js', function() {
                initBabylonMappingScene();
            });
        });
    } else if (!BABYLON.GridMaterial) {
        loadScript('https://cdn.babylonjs.com/materialsLibrary/babylon.gridMaterial.min.js', function() {
            initBabylonMappingScene();
        });
    } else {
        initBabylonMappingScene();
    }
})();

function getOrCreateBabylonContext() {
    let canvas = document.getElementById('babylon-shared-canvas');
    let engine = window._babylonEngine;
    let scene = window._babylonScene;
    let camera = window._babylonCamera;
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'babylon-shared-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '3';
        document.body.appendChild(canvas);
    }
    if (!engine) {
        engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});
        window._babylonEngine = engine;
    }
    if (!scene) {
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0,0,0,0);
        window._babylonScene = scene;
    }
    if (!camera) {
        camera = new BABYLON.ArcRotateCamera('camera', -Math.PI/2, Math.PI/3, 7, new BABYLON.Vector3(0,0,0), scene);
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 20;
        camera.wheelDeltaPercentage = 0.01;
        camera.pinchDeltaPercentage = 0.0005;
        camera.panningSensibility = 1000;
        camera.angularSensibilityX = 1000;
        camera.angularSensibilityY = 1000;
        window._babylonCamera = camera;
        scene.activeCamera = camera;
        // Light
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.9;
        // Render loop
        engine.runRenderLoop(function() {
            scene.render();
        });
        window.addEventListener('resize', function() {
            engine.resize();
        });
    }
    return {canvas, engine, scene, camera};
}

function initBabylonMappingScene() {
    const {scene, canvas} = getOrCreateBabylonContext();
    
    // Create a container for all scene objects
    const sceneContainer = new BABYLON.TransformNode('sceneContainer', scene);
    
    // Add grid
    if (!scene.getMeshByName('grid')) {
        const gridMaterial = new BABYLON.GridMaterial('grid', scene);
        gridMaterial.majorUnitFrequency = 10;  // Major lines every meter
        gridMaterial.minorUnitVisibility = 0.45;
        gridMaterial.gridRatio = 0.1;  // 1 unit = 0.1 meter (decimeter)
        gridMaterial.backFaceCulling = false;
        gridMaterial.mainColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        gridMaterial.lineColor = new BABYLON.Color3(0.2, 0.2, 0.8);
        gridMaterial.opacity = 0.85;
        const grid = BABYLON.MeshBuilder.CreateGround('grid', {width: 2, height: 2, subdivisions: 20}, scene);
        grid.material = gridMaterial;
        grid.position.y = 0;
        grid.parent = sceneContainer;
    }

    // Add axes
    if (!scene.getMeshByName('axisX')) {
        function createAxis(size, color, axis, name) {
            const points = [
                BABYLON.Vector3.Zero(),
                axis.scale(size)
            ];
            const axisLine = BABYLON.MeshBuilder.CreateLines(name, {points: points}, scene);
            axisLine.color = color;
            axisLine.parent = sceneContainer;
            return axisLine;
        }
        createAxis(0.2, new BABYLON.Color3(1,0,0), new BABYLON.Vector3(1,0,0), 'axisX'); // X
        createAxis(0.2, new BABYLON.Color3(0,1,0), new BABYLON.Vector3(0,1,0), 'axisY'); // Y
        createAxis(0.2, new BABYLON.Color3(0,0,1), new BABYLON.Vector3(0,0,1), 'axisZ'); // Z
    }

    // Add axis labels
    if (!scene.getMeshByName('labelX_1')) {
        function makeTextPlane(text, color, size, name) {
            const dynamicTexture = new BABYLON.DynamicTexture('DynamicTexture', 128, scene, true);
            dynamicTexture.hasAlpha = true;
            dynamicTexture.drawText(text, 50, 70, 'bold 20px Arial', color, 'transparent', true);
            const plane = BABYLON.MeshBuilder.CreatePlane(name, {size: size}, scene);
            const mat = new BABYLON.StandardMaterial('textPlaneMat', scene);
            mat.diffuseTexture = dynamicTexture;
            mat.emissiveColor = BABYLON.Color3.White();
            mat.backFaceCulling = false;
            mat.specularColor = BABYLON.Color3.Black();
            plane.material = mat;
            plane.parent = sceneContainer;
            return plane;
        }

        for (let i = -1; i <= 1; i++) {
            if (i === 0) continue;
            let labelX = makeTextPlane(i + 'm', 'blue', 0.35, 'labelX_' + i);
            labelX.position = new BABYLON.Vector3(i, 0.01, 0);
            labelX.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            scene.addMesh(labelX);
            let labelZ = makeTextPlane(i + 'm', 'red', 0.35, 'labelZ_' + i);
            labelZ.position = new BABYLON.Vector3(0, 0.01, i);
            labelZ.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            scene.addMesh(labelZ);
        }
    }
    
    // Camera frustum (pyramid)
    function addCameraFrustumBabylon() {
        // Frustum parameters
        const h = 0.3; // height
        const b = 0.2; // base size
        // Vertices: tip at (0,h,0), base is a square in y- direction
        const positions = [
            0, h, 0,    // tip (pointing up)
            -b/2, 0, -b/2,  // base corners
             b/2, 0, -b/2,
             b/2, 0,  b/2,
            -b/2, 0,  b/2
        ];
        const indices = [
            0,1,2, 0,2,3, 0,3,4, 0,4,1, // sides
            1,2,3, 1,3,4 // base
        ];
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        // Normals
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        vertexData.normals = normals;
        const mesh = new BABYLON.Mesh('cameraFrustum', scene);
        vertexData.applyToMesh(mesh);
        mesh.position = new BABYLON.Vector3(0, 1.5, -2);
        mesh.parent = sceneContainer;  // Make frustum a child of sceneContainer
        
        const mat = new BABYLON.StandardMaterial('frustumMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0, 0.8);
        mat.alpha = 0.7;
        mesh.material = mat;

        // Store original updateIMU function
        const originalUpdateIMU = Module._updateIMU;

        // Subscribe to sensor updates for frustum rotation
        Module._updateIMU = (wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz) => {
            // Call original function first
            if (originalUpdateIMU) {
                try {
                    originalUpdateIMU(wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz);
                } catch (e) {
                    console.error('Error in original updateIMU:', e);
                }
            } else {
                console.warn('No original updateIMU found');
            }

            // Convert degrees to radians for Babylon.js
            const toRad = Math.PI / 180;
            
            // Create rotation quaternion from device orientation
            const quaternion = BABYLON.Quaternion.RotationYawPitchRoll(
                wx * -toRad,  // yaw
                wy * -toRad,  // pitch
                wz * -toRad   // roll
            );
            
            // Apply absolute rotation to frustum
            mesh.rotationQuaternion = quaternion;
            
            // Update position based on acceleration
            const smoothingFactor = 0.1;
            const maxOffset = 1.0; // Maximum offset in any direction
            
            // Calculate new position with smoothing
            const newX = mesh.position.x + ax * smoothingFactor;
            const newY = mesh.position.y + ay * smoothingFactor;
            const newZ = mesh.position.z + az * smoothingFactor;

            // Apply position with bounds
            mesh.position = new BABYLON.Vector3(
                Math.max(-maxOffset, Math.min(maxOffset, newX)),
                Math.max(-maxOffset, Math.min(maxOffset, newY)),
                Math.max(-maxOffset, Math.min(maxOffset, newZ))
            );
            
            // Reset any accumulated rotation
            mesh.computeWorldMatrix(true);
        };

        return mesh;
    }
    if (!scene.getMeshByName('cameraFrustum')) {
        addCameraFrustumBabylon();
    }

    // Create mesh for tracking points
    let trackingPointsMesh = null;
    function createTrackingPointsMesh() {
        if (!trackingPointsMesh) {
            // Create a single mesh for all points using lines
            const points = [];
            for (let i = 0; i < 100; i++) { // Max 100 points
                points.push(new BABYLON.Vector3(0, 0, 0));
            }
            trackingPointsMesh = BABYLON.MeshBuilder.CreateLines('trackingPoints', {
                points: points,
                updatable: true
            }, scene);
            
            // Create material for points
            const material = new BABYLON.StandardMaterial('trackingPointsMat', scene);
            material.emissiveColor = new BABYLON.Color3(1, 0, 0); // Red color
            material.disableLighting = true;
            trackingPointsMesh.material = material;
            trackingPointsMesh.parent = sceneContainer;
        }
        return trackingPointsMesh;
    }

    // Variables for movement
    let lastAvgPoint = null;

    // Update scene position based on tracking points
    scene.registerBeforeRender(function() {
        if (window.Module && window.Module._getTrackingPoints && window.Module.HEAPF32) {
            try {
                const pointsPtr = window.Module._getTrackingPoints();
                const count = window.Module._getTrackingPointsCount();
                
                if (count > 0 && pointsPtr) {
                    // Get points from WebAssembly memory
                    const points = new Float32Array(window.Module.HEAPF32.buffer, pointsPtr, count * 2);
                    
                    // Convert points to array of objects
                    const trackingPoints = [];
                    for (let i = 0; i < count; i++) {
                        const x = points[i * 2];
                        const y = points[i * 2 + 1];
                        if (!isNaN(x) && !isNaN(y)) {
                            trackingPoints.push({x, y});
                        }
                    }

                    // Calculate weighted average
                    const avgPoint = averageTrackingPoints(trackingPoints);
                    
                    if (avgPoint) {
                        // Direct movement without smoothing
                        sceneContainer.position.x = avgPoint.x; // Remove minus
                        sceneContainer.position.y = avgPoint.y; // Remove minus

                        // Update tracking points visualization
                        const mesh = createTrackingPointsMesh();
                        const positions = trackingPoints.map(p => 
                            new BABYLON.Vector3(p.x, p.y, 0)
                        );
                        
                        if (positions.length > 0) {
                            // Update mesh positions
                            const vertexData = new BABYLON.VertexData();
                            vertexData.positions = positions.flatMap(p => [p.x, p.y, p.z]);
                            vertexData.applyToMesh(mesh);
                        }
                    }
                }
            } catch (e) {
                console.error('Error getting tracking points:', e, {
                    message: e.message,
                    stack: e.stack,
                    module: window.Module ? 'exists' : 'missing',
                    getTrackingPoints: window.Module && window.Module._getTrackingPoints ? 'exists' : 'missing',
                    getTrackingPointsCount: window.Module && window.Module._getTrackingPointsCount ? 'exists' : 'missing'
                });
            }
        }
    });
} 