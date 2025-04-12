#!/bin/bash

# Exit on error
set -e

# Change to script directory
cd "$(dirname "$0")"

# Configuration
OPENCV_VERSION="4.8.1"
OPENCV_SOURCE_DIR="opencv-${OPENCV_VERSION}"
OPENCV_BUILD_DIR="build_js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building OpenCV.js ${OPENCV_VERSION} for Emscripten${NC}"

# Check if emscripten is in PATH
if ! command -v emcmake &> /dev/null; then
    echo -e "${RED}Error: emcmake not found. Please activate Emscripten environment${NC}"
    exit 1
fi

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 not found. Please install Python 3${NC}"
    exit 1
fi

# Clone OpenCV if not exists
if [ ! -d "$OPENCV_SOURCE_DIR" ]; then
    echo "Cloning OpenCV..."
    git clone --branch ${OPENCV_VERSION} https://github.com/opencv/opencv.git ${OPENCV_SOURCE_DIR}
    git clone --branch ${OPENCV_VERSION} https://github.com/opencv/opencv_contrib.git ${OPENCV_SOURCE_DIR}_contrib
fi

# Build OpenCV.js
echo "Building OpenCV.js..."
cd ${OPENCV_SOURCE_DIR}
python3 platforms/js/build_js.py ../${OPENCV_BUILD_DIR} \
    --build_wasm \
    --simd \
    --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=../${OPENCV_SOURCE_DIR}_contrib/modules/"

echo -e "${GREEN}OpenCV.js build completed successfully!${NC}"
echo "Build directory: ${OPENCV_BUILD_DIR}" 