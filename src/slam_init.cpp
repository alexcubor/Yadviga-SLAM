#include <emscripten.h>
#include <iostream>
#include <string>

// Define functions to be exported to JavaScript
extern "C" {
 
    EMSCRIPTEN_KEEPALIVE
    void initializeSLAM(const char* canvasId) {
        std::string id(canvasId);
        std::cout << "Initializing SLAM with canvas ID: " << id << std::endl;
        
        EM_ASM_({
            const canvasId = UTF8ToString($0);
            console.log('Looking for canvas with ID:', canvasId);
            
            // Получаем canvas по переданному ID
            const canvas = document.getElementById(canvasId);
            console.log('Canvas element:', canvas);
            
            if (!canvas) {
                console.error('Canvas not found! Available elements:', document.body.innerHTML);
                return;
            }
            
            // Получаем контекст
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context!');
                return;
            }
            
            // Теперь у нас есть доступ к canvas и его контексту
            // Можно выполнять любые операции с canvas
            
            // Например, получить размеры
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            
            // Создаем элемент video
            const video = document.createElement('video');
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            
            // Запрашиваем доступ к камере
            console.log('Requesting camera access...');
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Используем заднюю камеру
                    width: { ideal: canvas.width },
                    height: { ideal: canvas.height }
                }
            })
            .then(stream => {
                console.log('Camera access granted');
                video.srcObject = stream;
                
                // Функция для отрисовки кадров
                function drawFrame() {
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        // Отрисовываем кадр из видео на canvas
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    }
                    // Запрашиваем следующий кадр
                    requestAnimationFrame(drawFrame);
                }
                
                // Начинаем отрисовку когда видео готово
                video.addEventListener('loadedmetadata', () => {
                    console.log('Video metadata loaded');
                    drawFrame();
                });
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
            });
        }, canvasId);
        
        std::cout << "SLAM system initialized with canvas!" << std::endl;
    }
}