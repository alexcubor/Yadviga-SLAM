cmake_minimum_required(VERSION 3.10)
project(SimpleSLAM)

# Установка флагов для компиляции
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Указание путей к заголовочным файлам
include_directories(${CMAKE_SOURCE_DIR}/include)

# Исходные файлы
set(SOURCES
    src/slam_init.cpp
)

# Создание WebAssembly
add_executable(slam_init ${SOURCES})

# Установка флагов для Emscripten
set_target_properties(slam_init PROPERTIES
    OUTPUT_NAME "slam_init"
    SUFFIX ".js"
    LINK_FLAGS "-s EXPORTED_FUNCTIONS='[\"_initializeSLAM\"]' \
                -s EXPORTED_RUNTIME_METHODS='[\"ccall\", \"cwrap\"]' \
                -s EXPORT_ES6=0 \
                -s SINGLE_FILE=1 \
                -s EXPORT_NAME='SlamInitModule' \
                -s ALLOW_MEMORY_GROWTH=1 \
                -s INITIAL_MEMORY=67108864 \
                -s MODULARIZE=1 \
                -s EXPORT_NAME='createModule'"
)

# Указание директорий для заголовочных файлов
target_include_directories(slam_init PUBLIC ${CMAKE_SOURCE_DIR}/include)
