#include <emscripten.h>
#include <iostream>

extern "C" void renderFrame();
extern "C" void startTracking();
extern "C" void initIMU();
// extern "C" void startMapping();


// Autorun function
int main() {

    EM_ASM_({
        console.log("🚀 Initialize ✅ Yadviga SLAM");
        // Main SLAM module
        window.YAGA = (function() {
            // Private attributes
            let isInitialized = false;
            let gl = null;
            let canvas = null;
            let frameCount = 0;
            
            // Private camera state
            const cameraState = {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                target: { x: 0, y: 0.5, z: 0 }
            };

            // Helper function to calculate rotation from position to target
            function calculateRotationFromTarget() {
                const dx = cameraState.target.x - cameraState.position.x;
                const dy = cameraState.target.y - cameraState.position.y;
                const dz = cameraState.target.z - cameraState.position.z;
                
                // Calculate yaw (rotation around Y axis)
                const yaw = Math.atan2(dx, dz);
                
                // Calculate pitch (rotation around X axis)
                const distance = Math.sqrt(dx * dx + dz * dz);
                const pitch = Math.atan2(dy, distance);
                
                cameraState.rotation = {
                    x: pitch,
                    y: yaw,
                    z: 0
                };
            }

            // Helper function to calculate target from rotation
            function calculateTargetFromRotation() {
                const distance = 1; // Distance to target
                const pitch = cameraState.rotation.x;
                const yaw = cameraState.rotation.y;
                
                cameraState.target = {
                    x: cameraState.position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
                    y: cameraState.position.y + Math.sin(pitch) * distance,
                    z: cameraState.position.z + Math.cos(yaw) * Math.cos(pitch) * distance
                };
            }

            // Camera getters and setters
            const camera = {
                get position() {
                    return cameraState.position;
                },
                set position(value) {
                    if (value && typeof value === 'object') {
                        cameraState.position = {
                            x: Number(value.x) || 0,
                            y: Number(value.y) || 0,
                            z: Number(value.z) || 0
                        };
                        // Recalculate target based on new position and rotation
                        calculateTargetFromRotation();
                        console.log('🎥 Camera position updated:', cameraState.position);
                    }
                },
                get rotation() {
                    return cameraState.rotation;
                },
                set rotation(value) {
                    if (value && typeof value === 'object') {
                        cameraState.rotation = {
                            x: Number(value.x) || 0,
                            y: Number(value.y) || 0,
                            z: Number(value.z) || 0
                        };
                        // Recalculate target based on new rotation
                        calculateTargetFromRotation();
                        console.log('🎥 Camera rotation updated:', cameraState.rotation);
                    }
                },
                get target() {
                    return cameraState.target;
                },
                set target(value) {
                    if (value && typeof value === 'object') {
                        cameraState.target = {
                            x: Number(value.x) || 0,
                            y: Number(value.y) || 0.5,
                            z: Number(value.z) || 0
                        };
                        // Recalculate rotation based on new target
                        calculateRotationFromTarget();
                        console.log('🎥 Camera target updated:', cameraState.target);
                    }
                }
            };
            
            // Public attributes
            return {
                init() {
                    isInitialized = true;
                },
                tags: {}, // Add tags object to store script attributes
                camera: camera
            };
        })();

        // Find our script tag
        const scripts = document.getElementsByTagName('script');
        let ourScript = null;
        for (let script of scripts) {
            if (script.src.includes('yadviga-slam.js')) {
                ourScript = script;
                break;
            }
        }
        
        // Store all attributes in YAGA.tags
        for (let attr of ourScript.attributes) {
            YAGA.tags[attr.name] = attr.value;
        }
    });

    // Initialize YAGA
    renderFrame();
    startTracking();
    initIMU();
    // startMapping();
}
