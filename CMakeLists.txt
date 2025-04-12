cmake_minimum_required(VERSION 3.10)
project(SimpleSLAM)

# Set flags for compilation
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set include directions
include_directories(${CMAKE_SOURCE_DIR}/include)

# Source files
set(SOURCES
    src/Initialize.cpp
    src/Tracking.cpp
    src/Mapping.cpp
    src/LoopClosure.cpp
    src/Renderer.cpp
)

# Create WebAssembly
add_executable(yadviga-slam ${SOURCES})

# Set flags for Emscripten
set_target_properties(yadviga-slam PROPERTIES
    OUTPUT_NAME "yadviga-slam"
    SUFFIX ".js"
    LINK_FLAGS "-s EXPORTED_FUNCTIONS='[\"_initializeSLAM\", \"_stopSLAM\", \"_initializeTracking\", \"_initializeRenderer\", \"_stopRenderer\"]' \
                -s EXPORTED_RUNTIME_METHODS='[\"ccall\", \"cwrap\"]' \
                -s EXPORT_ES6=0 \
                -s SINGLE_FILE=1 \
                -s EXPORT_NAME='SlamInitModule' \
                -s ALLOW_MEMORY_GROWTH=1 \
                -s INITIAL_MEMORY=67108864 \
                -s MODULARIZE=1 \
                -s EXPORT_NAME='createModule' \
                -s WASM=1 \
                -s ENVIRONMENT=web \
                -s NO_EXIT_RUNTIME=1 \
                -s STRICT=1"
)

# Set compiler flags for SIMD
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128")

# Set include directoriaes
target_include_directories(yadviga-slam PUBLIC ${CMAKE_SOURCE_DIR}/include)
