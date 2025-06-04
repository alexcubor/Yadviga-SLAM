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
            
            // Public attributes
            return {
                init() {
                    isInitialized = true;
                },
                tags: {} // Add tags object to store script attributes
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
    // startTracking();
    initIMU();
    // startMapping();
}
