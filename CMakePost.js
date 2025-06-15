const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

async function processFile() {
    try {
        // Read the compiled JavaScript file
        const jsFile = fs.readFileSync('yadviga-slam.js', 'utf8');

        // Read the JavaScript code from rendering.js
        const jsCode = fs.readFileSync(path.join(__dirname, 'core', 'RenderFrames.js'), 'utf8');

        // Minify the code using Terser
        const minified = await minify(jsCode, {
            compress: {
                dead_code: true,
                drop_console: false, // Keep console.logs for debugging
                drop_debugger: true,
                pure_funcs: [], // Keep all functions
                passes: 2
            },
            mangle: {
                toplevel: true,
                reserved: ['renderFrames'] // Prevent renaming of renderFrames function
            },
            format: {
                comments: false
            }
        });

        if (minified.error) {
            console.error('Error minifying code:', minified.error);
            process.exit(1);
        }

        // Replace RENDER_FRAMES_JS with the minified code
        const updatedJs = jsFile.replace(/RENDER_FRAMES_JS/g, `${minified.code}`);

        // Write the updated file
        fs.writeFileSync('yadviga-slam.js', updatedJs);
        console.log('✅ Successfully obfuscated RenderFrames.js and embedded into yadviga-slam.js');
    } catch (error) {
        console.error('Error processing files:', error);
        process.exit(1);
    }
}

processFile(); 