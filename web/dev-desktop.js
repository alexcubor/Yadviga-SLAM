// Main test container that manages all test UI components
class TestContainer {
    constructor() {
        this.components = new Map();
        this.uiContainer = null;
        this.isVisible = true;
        this.isSwipeEnabled = true;
        this.init();
    }

    init() {
        // Create main UI container
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'yaga-ui-container';
        this.uiContainer.style.position = 'fixed';
        this.uiContainer.style.padding = '1rem';
        this.uiContainer.style.width = '40rem';
        this.uiContainer.style.zIndex = '1000';
        this.uiContainer.style.display = 'flex';
        this.uiContainer.style.flexDirection = 'column';
        this.uiContainer.style.gap = '1rem';
        this.uiContainer.style.fontSize = '1rem';
        this.uiContainer.style.fontFamily = 'monospace';
        this.uiContainer.style.transition = 'transform 0.3s ease-out';

        // Добавляем глобальные стили
        const style = document.createElement('style');
        style.textContent = `
            #yaga-ui-container div {
                background-color: rgba(11, 19, 9, 0.5);
                border-radius: 0.375rem;
                padding: 0.5rem;
                font-family: monospace;
                font-size: 1rem;
                color: white;
                position: relative;
                overflow: hidden;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(this.uiContainer);

        // Add swipe to hide functionality
        this.setupSwipeToHide();
        
        // Add show on edge tap functionality
        this.setupEdgeTapShow();
    }

    setupSwipeToHide() {
        let touchStartX = 0;
        let touchEndX = 0;
        const SWIPE_THRESHOLD = 50; // Уменьшаем порог
        let isSwiping = false;
        let startTime = 0;
        let lastMoveTime = 0;
        let lastPointerX = 0;
        let isPointerDown = false;
        let currentTranslateX = 0;

        // Add trackpad swipe support using pointer events
        document.addEventListener('pointerdown', (e) => {
            if (!this.isSwipeEnabled) return;
            isPointerDown = true;
            lastPointerX = e.clientX;
            currentTranslateX = 0;
            this.uiContainer.style.transition = 'none'; // Отключаем анимацию при начале свайпа
        }, { passive: true });

        document.addEventListener('pointermove', (e) => {
            if (!this.isSwipeEnabled || !isPointerDown) return;
            
            const deltaX = e.clientX - lastPointerX;
            currentTranslateX += deltaX;
            
            // Ограничиваем перемещение
            currentTranslateX = Math.max(-200, Math.min(0, currentTranslateX));
            
            // Применяем трансформацию
            this.uiContainer.style.transform = `translateX(${currentTranslateX}px)`;
            
            lastPointerX = e.clientX;
        }, { passive: true });

        document.addEventListener('pointerup', () => {
            if (!isPointerDown) return;
            isPointerDown = false;
            
            // Включаем анимацию обратно
            this.uiContainer.style.transition = 'transform 0.3s ease-out';
            
            // Определяем, нужно ли скрыть UI
            if (currentTranslateX < -SWIPE_THRESHOLD) {
                this.hide();
                this.showHint(); // Показываем подсказку после скрытия
            } else {
                this.show();
            }
        }, { passive: true });

        document.addEventListener('pointercancel', () => {
            if (!isPointerDown) return;
            isPointerDown = false;
            this.uiContainer.style.transition = 'transform 0.3s ease-out';
            this.show();
        }, { passive: true });

        this.uiContainer.addEventListener('touchstart', (e) => {
            if (!this.isSwipeEnabled) return;
            touchStartX = e.touches[0].clientX;
            isSwiping = false;
            startTime = Date.now();
            lastMoveTime = startTime;
        }, { passive: true });

        this.uiContainer.addEventListener('touchmove', (e) => {
            if (!this.isSwipeEnabled) return;
            const currentTime = Date.now();
            const timeDiff = currentTime - lastMoveTime;
            lastMoveTime = currentTime;

            // Если прошло слишком мало времени с последнего движения, пропускаем
            if (timeDiff < 16) return; // ~60fps

            touchEndX = e.touches[0].clientX;
            const diff = touchStartX - touchEndX;
            
            // Если палец сдвинулся достаточно далеко, считаем это свайпом
            if (Math.abs(diff) > 10) {
                isSwiping = true;
            }
            
            // If swiping left, move UI exactly with the finger
            if (diff > 0 && isSwiping) {
                // Добавляем плавность движения
                const velocity = diff / timeDiff;
                const smoothDiff = diff * (1 + velocity * 0.1);
                this.uiContainer.style.transform = `translateX(${-smoothDiff}px)`;
            }
        }, { passive: true });

        this.uiContainer.addEventListener('touchend', () => {
            if (!this.isSwipeEnabled) return;
            const diff = touchStartX - touchEndX;
            const timeDiff = Date.now() - startTime;
            const velocity = diff / timeDiff;
            
            // Если это был свайп и свайп был достаточно длинным или быстрым
            if (isSwiping && (diff > SWIPE_THRESHOLD || velocity > 0.5)) {
                this.uiContainer.style.transition = 'transform 0.3s ease-out';
                this.uiContainer.style.transform = 'translateX(-200vw)';
                this.isVisible = false;
                this.showHint();
            } else {
                // Иначе возвращаем на место с анимацией
                this.uiContainer.style.transition = 'transform 0.3s ease-out';
                this.uiContainer.style.transform = 'translateX(0)';
            }

            // Сбрасываем transition после анимации
            setTimeout(() => {
                this.uiContainer.style.transition = '';
            }, 300);
        }, { passive: true });
    }

    setupEdgeTapShow() {
        const EDGE_THRESHOLD = 20; // Расстояние от края экрана для активации

        document.addEventListener('touchstart', (e) => {
            if (this.isVisible) return; // Если контейнер уже виден, ничего не делаем

            const touchX = e.touches[0].clientX;
            
            // Если нажатие было в пределах края экрана
            if (touchX < EDGE_THRESHOLD) {
                this.show();
            }
        }, { passive: true });
    }

    // Add a new test component
    addComponent(name, component) {
        if (this.components.has(name)) {
            console.warn(`Component ${name} already exists`);
            return;
        }
        this.components.set(name, component);
        this.uiContainer.appendChild(component.element);
    }

    // Remove a test component
    removeComponent(name) {
        const component = this.components.get(name);
        if (component) {
            this.uiContainer.removeChild(component.element);
            this.components.delete(name);
        }
    }

    // Show all UI components
    show() {
        this.uiContainer.style.transform = 'translateX(0)';
        this.isVisible = true;
    }

    // Hide all UI components
    hide() {
        this.uiContainer.style.transform = 'translateX(-200vw)';
        this.isVisible = false;
    }

    // Toggle visibility of all UI components
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    showHint() {
        // Удаляем предыдущую подсказку, если она есть
        const oldHint = document.getElementById('yaga-hint');
        if (oldHint) oldHint.remove();

        // Создаем новую подсказку
        const hint = document.createElement('div');
        hint.id = 'yaga-hint';
        hint.textContent = 'Tap left edge to show panels';
        Object.assign(hint.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            height: '100vh',
            width: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem',
            fontFamily: 'monospace',
            zIndex: '999',
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease-out',
            textShadow: '0 0 10px rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(255,0,0,0.9)',
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            padding: '1rem 0'
        });
        document.body.appendChild(hint);

        // Скрываем подсказку через 2 секунды
        setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => hint.remove(), 300);
        }, 2000);
    }

    disableSwipe() {
        this.isSwipeEnabled = false;
    }

    enableSwipe() {
        this.isSwipeEnabled = true;
    }
}

// Create global test container instance
window.testContainer = new TestContainer(); 

(function() {
    const isDesktop = /Win|Mac|Linux|X11|CrOS/.test(navigator.platform);
    document.documentElement.style.setProperty('font-size', isDesktop ? '0.6rem' : '1rem', 'important');
})();