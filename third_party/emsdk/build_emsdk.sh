#!/bin/bash

# Exit on error
set -e

# Change to script directory
cd "$(dirname "$0")"

# Configuration
EMSDK_VERSION="3.1.8"
EMSDK_DIR="emsdk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Emscripten SDK ${EMSDK_VERSION}${NC}"

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git not found. Please install Git${NC}"
    exit 1
fi

# Clone emsdk if not exists
if [ ! -d "$EMSDK_DIR" ]; then
    echo "Cloning emsdk..."
    git clone https://github.com/emscripten-core/emsdk.git ${EMSDK_DIR}
fi

# Install and activate emsdk
echo "Installing and activating emsdk..."
cd ${EMSDK_DIR}
./emsdk install ${EMSDK_VERSION}
./emsdk activate ${EMSDK_VERSION}

# Activate emsdk environment
echo "Activating emsdk environment..."
source ./emsdk_env.sh

echo -e "${GREEN}Emscripten SDK installation and activation completed successfully!${NC}" 