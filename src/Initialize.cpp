#include <emscripten.h>
#include <iostream>

extern "C" void renderFrame();
extern "C" void startTracking();
extern "C" void testTracking();
extern "C" void testFPS();


// Autorun function
int main() {
    std::cout << "Initialize.cpp ✅" << std::endl;
    renderFrame();
    startTracking();
    

    // ========================================================================================
    // Optional test functions
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

        // Check for test-tracking attribute
        if (ourScript.hasAttribute('test-tracking')) {
            Module._testTracking();
        }
        
        // Check for test-fps attribute
        if (ourScript.hasAttribute('test-fps')) {
            Module._testFPS();
        }
    });
}
