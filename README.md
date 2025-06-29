# ![Yadviga-SLAM](resources/logo.svg)

[![Development Status](https://img.shields.io/badge/status-in%20development-yellow)](https://github.com/yourusername/Yadviga-SLAM)

Yadviga-SLAM is a Simultaneous Localization and Mapping (SLAM) system designed specifically for web browser deployment. The project leverages modern C++ compiled to WebAssembly, enabling real-time SLAM capabilities directly in the browser without requiring any additional plugins or installations.

## Pipeline

```mermaid
graph TD
    %% Input Node
    A["📷 Input Frames"]
    
    %% Feature Detection
    B["✅ goodFeaturesToTrack<br/>Найти угловые точки<br/>Feature Detection"]
    
    %% Optical Flow
    C["✅ calcOpticalFlowPyrLK<br/>Отследить точки<br/>Optical Flow"]
    
    %% Descriptors
    D["✅ ORB::create + compute<br/>Вычислить дескрипторы<br/>Descriptors"]
    
    %% Feature Matching
    E["BFMatcher<br/>Сопоставить дескрипторы<br/>Feature Matching"]
    
    %% Motion Estimation
    F["✅ findEssentialMat<br/>Essential Matrix<br/>Motion Estimation"]
    
    %% Pose Recovery
    G["✅ recoverPose<br/>R, t матрицы<br/>Pose Recovery"]
    
    %% 3D Reconstruction
    H["triangulatePoints<br/>3D координаты<br/>3D Reconstruction"]
    
    %% Pose Estimation
    I["solvePnP<br/>Оценить позу<br/>Pose Estimation"]
    
    %% RANSAC Filtering
    J["solvePnPRansac<br/>Фильтрация выбросов<br/>RANSAC Filtering"]
    
    %% Bundle Adjustment
    K["Bundle Adjustment<br/>Оптимизация позы и точек<br/>Global Optimization"]
    
    %% Loop Closure Detection
    L["Loop Closure Detection<br/>Обнаружение замыкания<br/>Loop Detection"]
    
    %% Keyframe Selection
    M["Keyframe Selection<br/>Выбор ключевых кадров<br/>Keyframe Management"]
    
    %% Local Mapping
    N["Local Mapping<br/>Управление локальной картой<br/>Local Map"]
    
    %% Global Optimization
    O["Global Optimization<br/>Глобальная оптимизация"]
    
    %% Output
    P["🎥 Camera Pose<br/>Output"]
    Q["⛳️ 3D Environment Map"]
    
    %% Linear pipeline flow
    A --- B
    B --- C
    C --- D
    D --- E
    E --- F
    F --- G
    G --- H
    H --- I
    I --- J
    J --- K
    K --- L
    L --- M
    M --- N
    N --- O
    O --- P
    O --- Q
    
    %% Unified styling for all nodes
    classDef default fill:#253941, stroke-width:0, rx:15,ry:15
    
    %% Styling for arrows
    linkStyle default stroke:#737373,stroke-width:2px
```

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
     1. "Build Emscripten" - Run first (only on first setup)
     2. "Build OpenCV" - Run second (only on first setup)
     3. "Build Yadviga" - Run third
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
   cp yadviga-slam.js yadviga-slam.worker.js ../web/ || echo 'Failed to copy files'
   ```

## Testing and Debugging

### Running Tests
1. Press `F5` in VS Code to start debugging
2. The debugger will launch the web application

### Testing on Mobile Devices

To test the application on mobile devices, you can use a tunnel service to expose your local development server to the internet:

1. Start the local web server using the "Start Web Server" task
2. Use a tunnel service like [Tuna](https://my.tuna.am/) to create a public URL


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project uses the following third-party libraries:
- OpenCV, licensed under the Apache License 2.0
- Emscripten SDK, licensed under the MIT License

See [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) for more information. 