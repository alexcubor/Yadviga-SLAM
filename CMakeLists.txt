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
    "_renderFrames"
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
    "_setTrackingInterval"
    "_getTrackingInterval"
    "_initIMU"
    "_updateIMU"
    "_getCameraMotion"
    "_isMotionReady"
    "_getGoodPointsCount"
    "_getRawEssentialMatrix"
    "_getRawRotationMatrix"
    "_getRawTranslationVector"
    "_getRawInlierMask"
    "_getInlierMaskSize"
    "_getRawRecoverPoseStatus"
    "_getRecoverPoseStatusSize"
    "_isRawDataReady"
    "_getOpticalFlowPrevPoints"
    "_getOpticalFlowCurrPoints"
    "_getOpticalFlowStatus"
    "_getOpticalFlowError"
    "_getOpticalFlowPointsCount"
    "_isOpticalFlowReady"
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

# --- Find Node.js (prefer emsdk, fallback to system) ---
set(NODE_EXECUTABLE "")

# Prefer Node from emsdk if EMSDK env var is set
if(DEFINED ENV{EMSDK})
    file(GLOB EMSDK_NODE_CANDIDATES
        "$ENV{EMSDK}/node/*/bin/node"
    )
    list(LENGTH EMSDK_NODE_CANDIDATES EMSDK_NODE_COUNT)
    if(EMSDK_NODE_COUNT GREATER 0)
        list(GET EMSDK_NODE_CANDIDATES 0 EMSDK_NODE_PATH)
        if(EXISTS ${EMSDK_NODE_PATH})
            set(NODE_EXECUTABLE ${EMSDK_NODE_PATH})
        endif()
    endif()
endif()

# If not found, try system node
if(NOT NODE_EXECUTABLE)
    find_program(NODE_EXECUTABLE node)
endif()

# Fail if still not found
if(NOT NODE_EXECUTABLE)
    message(FATAL_ERROR "Node.js not found. Please install Node.js or activate emsdk_env.sh")
else()
    message(STATUS "Using Node.js at: ${NODE_EXECUTABLE}")
endif()

# Ensure terser is installed locally so CMakePost.js can run
find_program(NPM_EXECUTABLE npm)

if(NPM_EXECUTABLE)
    set(NODE_MODULES_DIR "${CMAKE_SOURCE_DIR}/node_modules")
    set(PACKAGE_JSON_FILE "${CMAKE_SOURCE_DIR}/package.json")

    # If no package.json, create one (minimal)
    if(NOT EXISTS "${PACKAGE_JSON_FILE}")
        message(STATUS "No package.json found, creating one...")
        execute_process(
            COMMAND ${NPM_EXECUTABLE} init -y
            WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
            OUTPUT_QUIET ERROR_QUIET
        )
    endif()

    # Add a custom target to install terser
    add_custom_target(npm_terser
        COMMAND ${NPM_EXECUTABLE} install --no-save terser
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        COMMENT "Ensuring terser is installed..."
    )

    # Make sure this runs before the post-build Node script
    add_dependencies(yadviga-slam npm_terser)
else()
    message(WARNING "npm not found — cannot auto-install terser. Please install it manually.")
endif()

# --- Post-build step ---
add_custom_command(
    TARGET yadviga-slam
    POST_BUILD
    COMMAND ${NODE_EXECUTABLE} ${CMAKE_SOURCE_DIR}/CMakePost.js
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
)