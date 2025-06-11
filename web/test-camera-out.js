// test-camera-out.js
// Интерактивный блюр при удержании и перемещении курсора
(function() {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    const MAX_BLUR = 1000; // Максимальный блюр в пикселях
    const MIN_BLUR = 0;  // Минимальный блюр в пикселях
    const MAX_DISTANCE = 10; // Расстояние, при котором достигается максимальный блюр

    // Сохраняем начальную позицию камеры при первом драге
    let dragStartCameraX = 0;
    let dragStartCameraY = 0;
    let dragStartCameraZ = 0;
    let isFirstDrag = true;

    function calculateBlur(distance) {
        // Используем квадратичную зависимость для более плавного эффекта
        const normalizedDistance = Math.min(distance / MAX_DISTANCE, 1);
        return MIN_BLUR + (normalizedDistance * normalizedDistance) * (MAX_BLUR - MIN_BLUR);
    }

    function updateBlur(canvas, currentX, currentY) {
        // Получаем камеру
        const camera = YAGA.camera;
        if (!camera) {
            console.log('🎥 Camera not available in updateBlur');
            return;
        }

        // Вычисляем относительное расстояние от начальной позиции драга
        const dx = (camera.position.x - dragStartCameraX) / MAX_DISTANCE;
        const dy = (camera.position.y - dragStartCameraY) / MAX_DISTANCE;
        const distance = Math.sqrt(dx * dx + dy * dy) * MAX_DISTANCE;
        
        const blurAmount = calculateBlur(distance);
        
        canvas.style.filter = `blur(${blurAmount}px)`;
        canvas.style.webkitFilter = `blur(${blurAmount}px)`;
        canvas.style.backdropFilter = `blur(${blurAmount}px)`;
    }

    function setupInteractiveBlur() {
        console.log('🎥 Setting up interactive blur');
        const canvas = YAGA.canvas;
        if (!canvas) {
            console.log('🎥 Canvas not available');
            return;
        }

        canvas.style.transition = 'filter 0.3s ease-out, transform 0.3s ease-out';
        canvas.style.willChange = 'filter, transform';

        function handleStart(e) {
            const target = e.target;
            if (target.closest('.ui-element, button, input, select, textarea')) return;
            
            isDragging = true;
            startX = e.clientX || e.touches[0].clientX;
            startY = e.clientY || e.touches[0].clientY;
            
            // Сохраняем позицию камеры при начале драга
            if (isFirstDrag && YAGA.camera) {
                dragStartCameraX = YAGA.camera.position.x;
                dragStartCameraY = YAGA.camera.position.y;
                dragStartCameraZ = YAGA.camera.position.z;
                isFirstDrag = false;
            }
            
            canvas.style.transition = 'none';
            updateBlur(canvas, startX, startY);

            e.preventDefault();
            e.stopPropagation();
        }

        function handleMove(e) {
            if (!isDragging) return;
            
            const currentX = e.clientX || e.touches[0].clientX;
            const currentY = e.clientY || e.touches[0].clientY;
            updateBlur(canvas, currentX, currentY);

            e.preventDefault();
            e.stopPropagation();
        }

        function handleEnd(e) {
            if (!isDragging) return;
            
            isDragging = false;
            
            if (typeof Module !== 'undefined' && Module._stopCamera) {
                Module._stopCamera();
            }
            
            // Не сбрасываем блюр, а обновляем его для текущей позиции
            const currentX = e.clientX || e.touches[0].clientX;
            const currentY = e.clientY || e.touches[0].clientY;
            updateBlur(canvas, currentX, currentY);

            e.preventDefault();
            e.stopPropagation();
        }

        // Находим все canvas и их родителей
        const allCanvases = document.querySelectorAll('canvas');
        const parents = new Set();
        allCanvases.forEach(c => {
            if (c.parentElement) parents.add(c.parentElement);
        });

        // Добавляем обработчики на все canvas
        allCanvases.forEach(c => {
            c.addEventListener('mousedown', handleStart);
            c.addEventListener('touchstart', handleStart);
        });

        // Добавляем обработчики на родителей
        parents.forEach(p => {
            p.addEventListener('mousedown', handleStart);
            p.addEventListener('touchstart', handleStart);
        });

        // Глобальные события для move и end
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('mouseleave', handleEnd);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);
    }

    // Ждём инициализации YAGA через MutationObserver
    const blurObserver = new MutationObserver((mutations) => {
        if (window.YAGA && window.YAGA.canvas) {
            console.log('🎥 YAGA and canvas found, disconnecting observer');
            blurObserver.disconnect();
            setupInteractiveBlur();
        }
    });

    blurObserver.observe(document, {
        childList: true,
        subtree: true
    });
})(); 