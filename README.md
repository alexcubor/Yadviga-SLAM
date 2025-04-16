# ![Yadviga-SLAM](resource/logo.svg)

[![Development Status](https://img.shields.io/badge/status-in%20development-yellow)](https://github.com/yourusername/Yadviga-SLAM)

Yadviga-SLAM is a Simultaneous Localization and Mapping (SLAM) system designed specifically for web browser deployment. The project leverages modern C++ compiled to WebAssembly, enabling real-time SLAM capabilities directly in the browser without requiring any additional plugins or installations.

## Development Environment

Recommended using Visual Studio Code IDE because the project includes pre-configured development environment:
- `.vscode/tasks.json` - Automates build process for Emscripten, OpenCV, and the project
- `.vscode/launch.json` - Configures Chrome debugging with source maps
- `.vscode/settings.json` - Sets up C++ and CMake integration with Emscripten

These configurations provide:
- One-click build and debug setup
- Automatic WebAssembly compilation
- Integrated browser debugging
- CMake project configuration
- C++ IntelliSense support

## Project Setup

### Prerequisites
- CMake (version 3.10 or higher)
- Emscripten SDK
- OpenCV

### Building with VS Code

1. **Build Process**
   - Press `Ctrl+Shift+B` to open the build tasks menu
   - Three tasks will appear:
     1. "Build Emscripten" - Run second
     2. "Build OpenCV" - Run third
   - After completing these tasks, the project will be ready for development

2. **Debugging**
   - Press `F5` to start debugging in Chrome
   - The debugger will automatically:
     - Start a local web server
     - Open Chrome with developer tools
     - Load the application

### Manual Setup (for other IDEs)

1. **Build Third-Party Dependencies**
   ```bash
   # Build Emscripten
   ./third_party/emsdk/build_emsdk.sh
   
   # Build OpenCV
   ./third_party/opencv/build_opencv.sh
   ```

2. **Build the Project**
   ```bash
   mkdir build
   cd build
   emcmake cmake .. -DCMAKE_CXX_FLAGS="-msimd128"
   emmake make -j4
   ```

## Testing and Debugging

### Running Tests
1. Press `F5` in VS Code to start debugging
2. The debugger will launch the web application

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project uses the following third-party libraries:
- OpenCV, licensed under the Apache License 2.0
- Emscripten SDK, licensed under the MIT License

See [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) for more information. 