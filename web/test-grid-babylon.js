// Enable log for Babylon.js grid
console.log('🟦 Enable test-grid-babylon.js');

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
                initBabylonGridScene();
            });
        });
    } else if (!BABYLON.GridMaterial) {
        loadScript('https://cdn.babylonjs.com/materialsLibrary/babylon.gridMaterial.min.js', function() {
            initBabylonGridScene();
        });
    } else {
        initBabylonGridScene();
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

function initBabylonGridScene() {
    const {scene} = getOrCreateBabylonContext();

    // Grid material
    if (!scene.getMeshByName('grid')) {
        const gridMaterial = new BABYLON.GridMaterial('grid', scene);
        gridMaterial.majorUnitFrequency = 1;
        gridMaterial.minorUnitVisibility = 0.45;
        gridMaterial.gridRatio = 1; // 1 unit = 1 meter
        gridMaterial.backFaceCulling = false;
        gridMaterial.mainColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        gridMaterial.lineColor = new BABYLON.Color3(0.2, 0.2, 0.8);
        gridMaterial.opacity = 0.85;
        const grid = BABYLON.MeshBuilder.CreateGround('grid', {width: 10, height: 10, subdivisions: 10}, scene);
        grid.material = gridMaterial;
        grid.position.y = 0;
    }
    // Axes
    if (!scene.getMeshByName('axisX')) {
        function createAxis(size, color, axis, name) {
            const points = [
                BABYLON.Vector3.Zero(),
                axis.scale(size)
            ];
            const axisLine = BABYLON.MeshBuilder.CreateLines(name, {points: points}, scene);
            axisLine.color = color;
            return axisLine;
        }
        createAxis(5, new BABYLON.Color3(1,0,0), new BABYLON.Vector3(1,0,0), 'axisX'); // X
        createAxis(5, new BABYLON.Color3(0,1,0), new BABYLON.Vector3(0,1,0), 'axisY'); // Y
        createAxis(5, new BABYLON.Color3(0,0,1), new BABYLON.Vector3(0,0,1), 'axisZ'); // Z
    }
    // Axis labels and meters label
    function makeTextPlane(text, color, size, name) {
        const dynamicTexture = new BABYLON.DynamicTexture('DynamicTexture', 128, scene, true);
        dynamicTexture.hasAlpha = true;
        dynamicTexture.drawText(text, 10, 80, 'bold 64px Arial', color, 'transparent', true);
        const plane = BABYLON.MeshBuilder.CreatePlane(name, {size: size}, scene);
        const mat = new BABYLON.StandardMaterial('textPlaneMat', scene);
        mat.diffuseTexture = dynamicTexture;
        mat.emissiveColor = BABYLON.Color3.White();
        mat.backFaceCulling = false;
        mat.specularColor = BABYLON.Color3.Black();
        plane.material = mat;
        return plane;
    }
    if (!scene.getMeshByName('labelX_1')) {
        for (let i = -5; i <= 5; i++) {
            if (i === 0) continue;
            let labelX = makeTextPlane(i.toString(), 'blue', 0.35, 'labelX_' + i);
            labelX.position = new BABYLON.Vector3(i, 0.01, 0);
            labelX.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            scene.addMesh(labelX);
            let labelZ = makeTextPlane(i.toString(), 'red', 0.35, 'labelZ_' + i);
            labelZ.position = new BABYLON.Vector3(0, 0.01, i);
            labelZ.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            scene.addMesh(labelZ);
        }
    }
    if (!scene.getMeshByName('metersLabel')) {
        let metersLabel = makeTextPlane('meters', 'black', 0.5, 'metersLabel');
        metersLabel.position = new BABYLON.Vector3(5.5, 0.01, 0);
        metersLabel.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        scene.addMesh(metersLabel);
    }
} 