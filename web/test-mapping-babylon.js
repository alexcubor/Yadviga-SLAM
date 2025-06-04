// Enable log for Babylon.js mapping
console.log('🟪 Enable test-mapping-babylon.js');

(function() {
    function loadScript(src, onload) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onload;
        document.head.appendChild(script);
    }
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
    const {scene} = getOrCreateBabylonContext();
    
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
        
        const mat = new BABYLON.StandardMaterial('frustumMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0, 0.8);
        mat.alpha = 0.7;
        mesh.material = mat;

        // Subscribe to sensor updates for frustum rotation
        if (window.sensorManager) {
            const updateFrustumFromSensors = () => {
                const { orientation } = window.sensorManager;
                
                // Convert degrees to radians
                const toRad = Math.PI / 180;
                
                // Create rotation quaternion from device orientation
                const quaternion = BABYLON.Quaternion.RotationYawPitchRoll(
                    orientation.alpha * -toRad,  // yaw
                    orientation.beta * -toRad,   // pitch
                    orientation.gamma * -toRad   // roll
                );
                
                // Apply absolute rotation to frustum
                mesh.rotationQuaternion = quaternion;
                
                // Reset any accumulated rotation
                mesh.computeWorldMatrix(true);
            };
            
            // Update frustum every frame
            scene.registerBeforeRender(updateFrustumFromSensors);
        }

        return mesh;
    }
    if (!scene.getMeshByName('cameraFrustum')) {
        addCameraFrustumBabylon();
    }
} 