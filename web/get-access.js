class SensorAccessManager {
    constructor() {
        this.onAccessGranted = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.createUI();
    }

    createUI() {
        // Calculate font scale based on device pixel ratio
        const isMobile = window.innerWidth <= 768;
        const baseFontScale = isMobile ? 2 : 1;

        // Remove existing modal if any
        const existingModal = document.getElementById('sensorAccessModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal for permissions
        const modal = document.createElement('div');
        modal.id = 'sensorAccessModal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '2000';
        modal.style.backdropFilter = 'blur(5px)';

        const modalContent = document.createElement('div');
        modalContent.style.background = 'var(--system-background-color, #fff)';
        modalContent.style.padding = isMobile ? '72px' : '48px';
        modalContent.style.borderRadius = '24px';
        modalContent.style.color = 'var(--system-text-color, #000)';
        modalContent.style.textAlign = 'center';
        modalContent.style.maxWidth = isMobile ? '95%' : '90%';
        modalContent.style.width = isMobile ? '90vw' : '600px';
        modalContent.style.boxShadow = 'var(--system-shadow, 0 4px 20px rgba(0,0,0,0.15))';
        modalContent.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        modalContent.style.fontSize = `${24 * baseFontScale}px`;

        const modalTitle = document.createElement('h2');
        modalTitle.textContent = 'Датчики пространства';
        modalTitle.style.margin = '0 0 48px 0';
        modalTitle.style.fontSize = `${36 * baseFontScale}px`;
        modalTitle.style.fontWeight = '600';
        modalTitle.style.color = 'var(--system-text-color, #000)';

        const modalText = document.createElement('p');
        modalText.textContent = 'Разрешите доступ к датчикам для отслеживания движений устройства';
        modalText.style.margin = '0 0 60px 0';
        modalText.style.fontSize = `${30 * baseFontScale}px`;
        modalText.style.lineHeight = '1.4';
        modalText.style.color = 'var(--system-secondary-text-color, #666)';

        const grantButton = document.createElement('button');
        grantButton.textContent = 'Разрешить';
        grantButton.style.width = '100%';
        grantButton.style.padding = isMobile ? '36px' : '24px';
        grantButton.style.fontSize = `${30 * baseFontScale}px`;
        grantButton.style.fontWeight = '500';
        grantButton.style.cursor = 'pointer';
        grantButton.style.backgroundColor = 'var(--system-accent-color, #007AFF)';
        grantButton.style.color = 'white';
        grantButton.style.border = 'none';
        grantButton.style.borderRadius = '18px';
        grantButton.style.transition = 'opacity 0.2s';

        grantButton.onmouseover = () => grantButton.style.opacity = '0.9';
        grantButton.onmouseout = () => grantButton.style.opacity = '1';

        grantButton.onclick = async () => {
            try {
                // Request motion and orientation permissions
                let motionPermission = 'granted';
                let orientationPermission = 'granted';
                
                if (typeof DeviceMotionEvent.requestPermission === 'function') {
                    try {
                        motionPermission = await DeviceMotionEvent.requestPermission();
                    } catch (err) {
                        console.warn('Motion permission error:', err);
                        motionPermission = 'denied';
                    }

                    try {
                        orientationPermission = await DeviceOrientationEvent.requestPermission();
                    } catch (err) {
                        console.warn('Orientation permission error:', err);
                        orientationPermission = 'denied';
                    }
                }

                if (motionPermission === 'granted' && orientationPermission === 'granted') {
                    modal.style.display = 'none';
                    if (this.onAccessGranted) {
                        this.onAccessGranted();
                    }
                } else {
                    throw new Error(`Permission denied: motion=${motionPermission}, orientation=${orientationPermission}`);
                }
            } catch (err) {
                console.error('Error requesting permission:', err);
                modalText.textContent = '❌ Доступ запрещен. Пожалуйста, разрешите доступ к датчикам в настройках браузера.';
                modalText.style.color = '#ff4444';
                grantButton.textContent = 'Попробовать снова';
            }
        };

        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalText);
        modalContent.appendChild(grantButton);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Force display the modal
        modal.style.display = 'flex';
    }
}

// Export for use in other files
window.SensorAccessManager = SensorAccessManager;

// Wrap observer in IIFE to avoid variable redeclaration
(function() {
    const observer = new MutationObserver((mutations) => {
        if (window.YAGA) {
            observer.disconnect();
            console.log('🔐 Enable get-access-sensors.js');
            const sensorManager = new SensorAccessManager();
            sensorManager.init();
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
})(); 