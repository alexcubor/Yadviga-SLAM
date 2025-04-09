#include <emscripten.h>
#include <iostream>
#include <string>
#include <opencv2/opencv.hpp>
#include <opencv2/tracking.hpp>

// Глобальные переменные для хранения состояния трекера
cv::Ptr<cv::Tracker> tracker;
cv::Rect2d bbox;
bool trackerInitialized = false;

// Функция для инициализации трекера
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void initializeTracker(const char* trackerType) {
        std::string type(trackerType);
        std::cout << "Initializing tracker with type: " << type << std::endl;
        
        // Создаем трекер в зависимости от типа
        if (type == "CSRT") {
            tracker = cv::TrackerCSRT::create();
        } else if (type == "KCF") {
            tracker = cv::TrackerKCF::create();
        } else if (type == "MOSSE") {
            tracker = cv::TrackerMOSSE::create();
        } else {
            // По умолчанию используем KCF
            tracker = cv::TrackerKCF::create();
        }
        
        trackerInitialized = false;
        std::cout << "Tracker initialized successfully" << std::endl;
    }
    
    // Функция для установки области отслеживания
    EMSCRIPTEN_KEEPALIVE
    void setTrackingRegion(int x, int y, int width, int height) {
        if (!tracker) {
            std::cout << "Tracker not initialized!" << std::endl;
            return;
        }
        
        bbox = cv::Rect2d(x, y, width, height);
        std::cout << "Tracking region set to: " << bbox << std::endl;
    }
    
    // Функция для обработки кадра и обновления трекера
    EMSCRIPTEN_KEEPALIVE
    unsigned char* processFrame(const unsigned char* imageData, int width, int height) {
        if (!tracker) {
            std::cout << "Tracker not initialized!" << std::endl;
            return nullptr;
        }
        
        // Создаем Mat из данных изображения
        cv::Mat frame(height, width, CV_8UC4, (void*)imageData);
        
        // Конвертируем из RGBA в BGR (OpenCV использует BGR)
        cv::Mat bgrFrame;
        cv::cvtColor(frame, bgrFrame, cv::COLOR_RGBA2BGR);
        
        // Если трекер не инициализирован, инициализируем его
        if (!trackerInitialized && bbox.width > 0 && bbox.height > 0) {
            bool ok = tracker->init(bgrFrame, bbox);
            if (ok) {
                trackerInitialized = true;
                std::cout << "Tracker initialized with region: " << bbox << std::endl;
            } else {
                std::cout << "Failed to initialize tracker!" << std::endl;
            }
        } 
        // Если трекер инициализирован, обновляем его
        else if (trackerInitialized) {
            bool ok = tracker->update(bgrFrame, bbox);
            if (ok) {
                std::cout << "Tracking successful, bbox: " << bbox << std::endl;
                
                // Рисуем прямоугольник на изображении
                cv::rectangle(frame, bbox, cv::Scalar(0, 255, 0), 2);
            } else {
                std::cout << "Tracking failed!" << std::endl;
            }
        }
        
        // Выделяем память для возвращаемых данных
        unsigned char* result = (unsigned char*)malloc(frame.total() * frame.elemSize());
        memcpy(result, frame.data, frame.total() * frame.elemSize());
        
        return result;
    }
    
    // Функция для освобождения памяти
    EMSCRIPTEN_KEEPALIVE
    void freeImageData(unsigned char* data) {
        free(data);
    }
    
    // Функция для получения текущей области отслеживания
    EMSCRIPTEN_KEEPALIVE
    void getTrackingRegion(int* x, int* y, int* width, int* height) {
        *x = static_cast<int>(bbox.x);
        *y = static_cast<int>(bbox.y);
        *width = static_cast<int>(bbox.width);
        *height = static_cast<int>(bbox.height);
    }
    
    // Новая функция для интеграции с видео потоком из slam_init.cpp
    EMSCRIPTEN_KEEPALIVE
    void processVideoFrame(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Processing video frame from canvas: " << id << std::endl;
        
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            const canvas = document.getElementById(canvasId);
            
            if (!canvas) {
                console.error('Canvas not found for tracking!');
                return;
            }
            
            // Получаем данные изображения с canvas
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Вызываем функцию processFrame с данными изображения
            const buffer = Module._malloc(imageData.data.length);
            const data = new Uint8Array(Module.HEAPU8.buffer, buffer, imageData.data.length);
            data.set(imageData.data);
            
            // Обрабатываем кадр и получаем результат
            const resultBuffer = Module._processFrame(buffer, canvas.width, canvas.height);
            
            if (resultBuffer) {
                // Создаем новый ImageData с результатами
                const resultData = new Uint8Array(Module.HEAPU8.buffer, resultBuffer, imageData.data.length);
                const newImageData = new ImageData(
                    new Uint8ClampedArray(resultData),
                    canvas.width,
                    canvas.height
                );
                
                // Отрисовываем результат на canvas
                ctx.putImageData(newImageData, 0, 0);
                
                // Освобождаем память
                Module._freeImageData(resultBuffer);
            }
            
            // Освобождаем память
            Module._free(buffer);
        }, canvasId);
    }
} 