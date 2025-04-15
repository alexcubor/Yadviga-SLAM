#ifndef TRACKING_H
#define TRACKING_H

#include <emscripten.h>
#include <opencv2/opencv.hpp>
#include <vector>

// Структура для хранения результатов трекинга
struct TrackingResult {
    float* points;      // Массив координат точек (x1,y1,x2,y2,...)
    int numPoints;      // Количество точек
    float* status;      // Статус каждой точки (1 - успешно отслежена, 0 - потеряна)
};

#ifdef __cplusplus
extern "C" {
#endif

// Инициализация трекера
EMSCRIPTEN_KEEPALIVE
TrackingResult* initializeTracker();

// Внутренняя C++ функция для обработки данных кадра
EMSCRIPTEN_KEEPALIVE
TrackingResult* _initializeTracker(uint8_t* imageData, int width, int height);

#ifdef __cplusplus
}
#endif

#endif // TRACKING_H
