#include <emscripten.h>
#include <iostream>

extern "C" void renderFrame();
extern "C" void initThreeScene();
extern "C" void startTracking();
extern "C" void startMapping();


// Autorun function
int main() {
    std::cout << "🚀 Initialize ✅ Yadviga SLAM" << std::endl;
    renderFrame();
    initThreeScene();
    startTracking();
    // startMapping();
    

    // ========================================================================================
    // Run functions by tag attributes
    // ========================================================================================

    // Check script tag attributes for test functions
    EM_ASM_({
        // Find our script tag
        const scripts = document.getElementsByTagName('script');
        let ourScript = null;
        for (let script of scripts) {
            if (script.src.includes('yadviga-slam.js')) {
                ourScript = script;
                break;
            }
        }

        if (!ourScript) {
            console.error('Script tag not found');
            return;
        }
        
        // Check for test-fps attribute
        if (!ourScript.hasAttribute('disable-logo')) {
            Module._showLogo();
        }
    });
}
