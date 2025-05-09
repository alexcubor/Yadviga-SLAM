#include <emscripten.h>
#include <iostream>

extern "C" void renderFrame();
extern "C" void startTracking();
extern "C" void startMapping();
extern "C" void testFPS();


// Autorun function
int main() {
    std::cout << "Initialize.cpp ✅" << std::endl;
    renderFrame();
    startTracking();
    startMapping();
    

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
        if (ourScript.hasAttribute('test-fps')) {
            Module._testFPS();
        }
    });
}
