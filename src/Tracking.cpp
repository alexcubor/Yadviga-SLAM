#include <emscripten.h>
#include <iostream>
#include <string>
#include "../include/Tracking.h"
#include <opencv2/opencv.hpp>
#include <opencv2/video/tracking.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <vector>

// ============================================================================
// Глобальные переменные для хранения состояния трекера
// ============================================================================
// Предыдущие точки для трекинга
std::vector<cv::Point2f> prevPoints;
// Следующие точки после трекинга
std::vector<cv::Point2f> nextPoints;
// Статусы точек (1 - успешно отслежена, 0 - потеряна)
std::vector<uchar> status;
// Ошибки трекинга для каждой точки
std::vector<float> err;
// Предыдущий кадр в оттенках серого
cv::Mat prevFrame;
// Область интереса для трекинга
cv::Rect2d bbox;
// Флаг инициализации трекера
bool isInitialized = false;

// ============================================================================
// Функции, экспортируемые в JavaScript
// ============================================================================
extern "C" {
    // ============================================================================
    // Инициализация трекера
    // ============================================================================
    EMSCRIPTEN_KEEPALIVE
    TrackingResult* initializeTracker() {
        EM_ASM_({
            const ctx = window.canvas.getContext('2d');
            
            // Получаем данные изображения
            const imageData = ctx.getImageData(0, 0, window.canvas.width, window.canvas.height);
            const buffer = imageData.data.buffer;
            
            console.log('Setting timeout for _initializeTracker...');
            setTimeout(function() {
                console.log('Calling _initializeTracker...');
                Module.ccall('_initializeTracker', 'number', 
                    ['number', 'number', 'number'], 
                    [buffer, window.canvas.width, window.canvas.height]);
            }, 0);
        });
        
        return nullptr; // Этот return никогда не будет выполнен
    }
    
    // Внутренняя C++ функция для обработки данных кадра
    EMSCRIPTEN_KEEPALIVE
    TrackingResult* _initializeTracker(uint8_t* imageData, int width, int height) {
        std::cout << "=== _initializeTracker called ===" << std::endl;
        std::cout << "Image size: " << width << "x" << height << std::endl;
        
        // Создание OpenCV матрицы из данных изображения
        cv::Mat frame(height, width, CV_8UC4, imageData);
        std::cout << "Frame created: " << frame.rows << "x" << frame.cols << std::endl;
        
        // Конвертация в оттенки серого
        cv::Mat grayFrame;
        cv::cvtColor(frame, grayFrame, cv::COLOR_RGBA2GRAY);
        std::cout << "Gray frame created" << std::endl;

        // Поиск хороших точек для отслеживания
        std::vector<cv::Point2f> points;
        std::cout << "Looking for good features to track..." << std::endl;
        cv::goodFeaturesToTrack(grayFrame,    // Input image
                               points,         // Output points
                               100,           // Max number of points
                               0.01,          // Quality level
                               10,            // Min distance between points
                               cv::Mat(),     // Mask
                               3,             // Block size
                               false,         // Use Harris detector
                               0.04);         // Harris parameter
        std::cout << "Found " << points.size() << " points to track" << std::endl;

        return nullptr;
    }
}