#!/bin/bash

# Exit on error
set -e

# Change to script directory
cd "$(dirname "$0")"

# Configuration
OPENCV_VERSION="4.8.1"
OPENCV_SOURCE_DIR="opencv-${OPENCV_VERSION}"
OPENCV_BUILD_DIR="build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building OpenCV ${OPENCV_VERSION} for Emscripten${NC}"

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

# Handle build directory
if [ -d "$OPENCV_BUILD_DIR" ]; then
    echo "Cleaning build directory..."
    rm -rf "$OPENCV_BUILD_DIR"/*
else
    echo "Creating build directory..."
    mkdir -p "$OPENCV_BUILD_DIR"
fi

cd ${OPENCV_BUILD_DIR}

# Configure and build OpenCV
echo "Configuring OpenCV..."
emcmake cmake -DCMAKE_BUILD_TYPE=Release \
              -DCMAKE_INSTALL_PREFIX="${PWD}/../install" \
              -DCMAKE_CXX_FLAGS="-msimd128 -matomics -mbulk-memory -pthread -Wno-deprecated-declarations -Wno-deprecated -Wno-deprecated-enum-enum-conversion -Wno-undef" \
              -DCMAKE_C_FLAGS="-msimd128 -matomics -mbulk-memory -pthread -Wno-deprecated-declarations -Wno-deprecated -Wno-deprecated-enum-enum-conversion -Wno-undef" \
              -DOPENCV_EXTRA_MODULES_PATH="../${OPENCV_SOURCE_DIR}_contrib/modules" \
              -DBUILD_SHARED_LIBS=OFF \
              -DENABLE_PIC=FALSE \
              -DCPU_BASELINE="WASM,WASM_SIMD128" \
              -DCPU_DISPATCH="" \
              -DCV_TRACE=OFF \
              -DBUILD_opencv_apps=OFF \
              -DBUILD_opencv_js=ON \
              -DBUILD_TESTS=OFF \
              -DBUILD_PERF_TESTS=OFF \
              -DBUILD_EXAMPLES=OFF \
              -DBUILD_DOCS=OFF \
              -DBUILD_opencv_imgcodecs=ON \
              -DBUILD_opencv_videoio=OFF \
              -DBUILD_opencv_highgui=OFF \
              -DBUILD_opencv_dnn=ON \
              -DBUILD_opencv_ml=ON \
              -DBUILD_opencv_photo=OFF \
              -DBUILD_opencv_stitching=OFF \
              -DBUILD_opencv_video=ON \
              -DBUILD_opencv_objdetect=ON \
              -DBUILD_opencv_xfeatures2d=OFF \
              -DBUILD_opencv_shape=OFF \
              -DBUILD_opencv_superres=OFF \
              -DBUILD_opencv_videostab=OFF \
              -DBUILD_opencv_ximgproc=OFF \
              -DBUILD_opencv_xobjdetect=OFF \
              -DBUILD_opencv_xphoto=OFF \
              -DBUILD_opencv_aruco=ON \
              -DBUILD_opencv_bgsegm=OFF \
              -DBUILD_opencv_bioinspired=OFF \
              -DBUILD_opencv_ccalib=OFF \
              -DBUILD_opencv_datasets=ON \
              -DBUILD_opencv_dnn_objdetect=OFF \
              -DBUILD_opencv_dpm=OFF \
              -DBUILD_opencv_face=OFF \
              -DBUILD_opencv_fuzzy=OFF \
              -DBUILD_opencv_hfs=OFF \
              -DBUILD_opencv_img_hash=OFF \
              -DBUILD_opencv_line_descriptor=OFF \
              -DBUILD_opencv_optflow=OFF \
              -DBUILD_opencv_phase_unwrapping=OFF \
              -DBUILD_opencv_plot=ON \
              -DBUILD_opencv_reg=OFF \
              -DBUILD_opencv_rgbd=OFF \
              -DBUILD_opencv_saliency=OFF \
              -DBUILD_opencv_stereo=OFF \
              -DBUILD_opencv_structured_light=OFF \
              -DBUILD_opencv_surface_matching=OFF \
              -DBUILD_opencv_text=OFF \
              -DBUILD_opencv_tracking=ON \
              -DBUILD_opencv_gapi=OFF \
              -DBUILD_opencv_flann=ON \
              -DBUILD_opencv_java=OFF \
              -DBUILD_opencv_python2=OFF \
              -DBUILD_opencv_python3=OFF \
              -DBUILD_opencv_calib3d=ON \
              -DBUILD_opencv_features2d=ON \
              -DWITH_1394=OFF \
              -DWITH_ADE=OFF \
              -DWITH_VTK=OFF \
              -DWITH_EIGEN=OFF \
              -DWITH_FFMPEG=OFF \
              -DWITH_GSTREAMER=OFF \
              -DWITH_GTK=OFF \
              -DWITH_GTK_2_X=OFF \
              -DWITH_IPP=OFF \
              -DWITH_AVIF=OFF \
              -DWITH_JASPER=OFF \
              -DWITH_JPEG=OFF \
              -DWITH_WEBP=OFF \
              -DWITH_OPENEXR=OFF \
              -DWITH_OPENJPEG=OFF \
              -DWITH_OPENGL=OFF \
              -DWITH_OPENVX=OFF \
              -DWITH_OPENNI=OFF \
              -DWITH_OPENNI2=OFF \
              -DWITH_PNG=OFF \
              -DWITH_TBB=OFF \
              -DWITH_TIFF=OFF \
              -DWITH_V4L=OFF \
              -DWITH_OPENCL=OFF \
              -DWITH_OPENCL_SVM=OFF \
              -DWITH_OPENCLAMDFFT=OFF \
              -DWITH_OPENCLAMDBLAS=OFF \
              -DWITH_GPHOTO2=OFF \
              -DWITH_LAPACK=OFF \
              -DWITH_ITT=OFF \
              -DWITH_QUIRC=OFF \
              -DWITH_ZLIB=OFF \
              -DBUILD_ZLIB=OFF \
              -DWITH_PTHREADS_PF=OFF \
              -DCV_ENABLE_INTRINSICS=ON \
              -DOPENCV_HAL_SIMD_INTRINSICS_ONLY_32F=ON \
              -DOPENCV_HAL_SIMD_NO_64F=ON \
              ../${OPENCV_SOURCE_DIR}

echo "Building OpenCV..."
emmake make -j4
emmake make install

echo -e "${GREEN}OpenCV build completed successfully!${NC}"
echo "Build directory: ${OPENCV_BUILD_DIR}"
echo "Install directory: ${OPENCV_BUILD_DIR}/../install" 