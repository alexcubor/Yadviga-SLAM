cmake_minimum_required(VERSION 3.10)
project(yadviga-slam)

# Set C++ standard
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenCV
set(OpenCV_DIR "${CMAKE_SOURCE_DIR}/third_party/opencv/build")
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
    src/Tracking.cpp
    src/Rendering.cpp
)

# Create executable
add_executable(yadviga-slam ${SOURCES})

# Link OpenCV libraries
target_link_libraries(yadviga-slam ${OpenCV_LIBS})

# Declare list of exported functions
set(EXPORTED_FUNCS
    "_main"
    "_renderFrame"
    "_setFrameReady"
    "_getFrameReady"
    "_getFrameBuffer"
    "_getFrameBufferSize"
    "_setFrameBuffer"
    "_setFrameBufferSize"
    "_setFrameWidth"
    "_setFrameHeight"
    "_startTracking"
    "_getTrackingPoints"
    "_getTrackingPointsCount"
    "_arePointsReady"
    "_testTracking"
    "_testFPS"
)
# Convert list to string with square brackets and commas
string(JOIN "," EXPORTED_FUNCS_STR ${EXPORTED_FUNCS})

# Set Emscripten-specific flags
set_target_properties(yadviga-slam PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "-s SINGLE_FILE=1 -s INVOKE_RUN=1 -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=1 -s WASM_ASYNC_COMPILATION=1 -s EXPORTED_FUNCTIONS=[${EXPORTED_FUNCS_STR}] -s ALLOW_MEMORY_GROWTH=1 -s SHARED_MEMORY=1"
)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -matomics -mbulk-memory -pthread")