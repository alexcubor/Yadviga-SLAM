cmake_minimum_required(VERSION 3.10)
project(yadviga-slam)

# Set C++ standard
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Debug flags
set(CMAKE_BUILD_TYPE Debug)
set(CMAKE_CXX_FLAGS_DEBUG "-gsource-map -O0")

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
    ${CMAKE_SOURCE_DIR}/core
    ${OpenCV_INCLUDE_DIRS}
)

# Add source files
set(SOURCES
    core/Initialize.cpp
    core/Tracking.cpp
    core/Sensors.cpp
    core/Rendering.cpp
    # core/Mapping.cpp
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
    "_initIMU"
    "_updateIMU"
)
# Convert list to string with square brackets and commas
string(JOIN "," EXPORTED_FUNCS_STR ${EXPORTED_FUNCS})

# Set Emscripten-specific flags
set_target_properties(yadviga-slam PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "-s SINGLE_FILE=1 -s INVOKE_RUN=1 -s USE_PTHREADS=0 -s WASM_ASYNC_COMPILATION=1 -s EXPORTED_FUNCTIONS=[${EXPORTED_FUNCS_STR}] -s ALLOW_MEMORY_GROWTH=1 -s ASYNCIFY=1"
)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -mbulk-memory -s ASYNCIFY")

# Read SVG file and create header
file(READ ${CMAKE_SOURCE_DIR}/resources/logo.svg LOGO_SVG_CONTENT)
string(REPLACE "\"" "\\\"" LOGO_SVG_CONTENT "${LOGO_SVG_CONTENT}")
string(REPLACE "\n" "\\n" LOGO_SVG_CONTENT "${LOGO_SVG_CONTENT}")
configure_file(
    ${CMAKE_SOURCE_DIR}/resources/logo.svg.h.in
    ${CMAKE_BINARY_DIR}/logo.svg.h
    @ONLY
)

# Add binary directory to include paths
include_directories(${CMAKE_BINARY_DIR})