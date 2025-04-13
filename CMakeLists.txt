cmake_minimum_required(VERSION 3.10)
project(yadviga-slam)

# Set C++ standard
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenCV
set(OpenCV_DIR "${CMAKE_SOURCE_DIR}/ThirdParty/opencv/build")
find_package(OpenCV REQUIRED COMPONENTS
    core
    imgproc
    calib3d
    tracking
    features2d
)

# Add include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/src
    ${OpenCV_INCLUDE_DIRS}
)

# Add source files
set(SOURCES
    src/Initialize.cpp
    src/Mapping.cpp
    src/Tracking.cpp
    src/LoopClosure.cpp
    src/Renderer.cpp
)

# Create executable
add_executable(yadviga-slam ${SOURCES})

# Link OpenCV libraries
target_link_libraries(yadviga-slam ${OpenCV_LIBS})

# Set Emscripten-specific flags
set_target_properties(yadviga-slam PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "-s EXPORT_ES6=0 -s MODULARIZE=1 -s EXPORT_NAME='createModule' -s EXPORTED_FUNCTIONS=['_malloc','_free','_initializeSLAM','_processFrame','_setTrackingRegion','_getTrackingRegion'] -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s WASM=1 -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 -s ENVIRONMENT='web'"
)
