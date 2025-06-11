// Main test container that manages all test UI components
class TestContainer {
    constructor() {
        this.components = new Map();
        this.uiContainer = null;
        this.isVisible = localStorage.getItem('yaga-ui-visible') !== 'false'; // Restore state from localStorage
        this.isSwipeEnabled = true;
        this.init();
    }

    init() {
        // Create main UI container
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'yaga-ui-container';
        this.uiContainer.style.position = 'fixed';
        this.uiContainer.style.top = '0';
        this.uiContainer.style.left = '0.5rem';
        this.uiContainer.style.width = '40rem';
        this.uiContainer.style.height = '100vh';
        this.uiContainer.style.zIndex = '1000';
        this.uiContainer.style.transition = 'transform 0.3s ease-out';
        this.uiContainer.style.overflowY = 'scroll';
        this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        this.uiContainer.style.pointerEvents = 'none'; // Allow events to pass through parent

        // Create inner container for content
        this.contentContainer = document.createElement('div');
        this.contentContainer.style.height = '100%';
        this.contentContainer.style.overflowY = 'auto';
        this.contentContainer.style.top = '0.5rem';
        this.contentContainer.style.padding = '0px';
        this.contentContainer.style.paddingRight = '1rem';
        this.contentContainer.style.display = 'flex';
        this.contentContainer.style.flexDirection = 'column';
        this.contentContainer.style.flexWrap = 'nowrap';
        this.contentContainer.style.alignItems = 'stretch';
        this.contentContainer.style.gap = '0.5rem';
        this.contentContainer.style.fontSize = '1rem';
        this.contentContainer.style.fontFamily = 'monospace';
        this.contentContainer.style.pointerEvents = 'none'; // Allow events to pass through parent
        this.uiContainer.appendChild(this.contentContainer);
        this.contentContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';

        // Set initial position based on saved state
        if (!this.isVisible) {
            this.uiContainer.style.transform = 'translateX(-200vw)';
            // Show hint on load if panels are hidden
            setTimeout(() => this.showHint(), 500); // Small delay for smoothness
        }

        // Add global styles
        const style = document.createElement('style');
        style.textContent = `
            #yaga-ui-container * {
                pointer-events: auto;
            }
            #yaga-ui-container div {
                background-color: rgba(11, 19, 9, 0.5);
                color: rgba(255, 255, 255, 0.6);
                border-radius: 0.375rem;
                padding: 0.5rem;
                font-family: monospace;
                font-size: 1rem;
                position: relative;
                overflow: hidden;
                line-height: 1.4;
            }
            #yaga-ui-container button {
                color: rgba(255, 255, 255, 0.6);
                font-family: monospace;
                font-size: 1rem;
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
            }
            #yaga-ui-container button:hover {
                color: rgba(255, 255, 255, 0.8);
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
        const SWIPE_THRESHOLD = 50;
        let isSwiping = false;
        let startTime = 0;
        let lastMoveTime = 0;
        let lastPointerX = 0;
        let isPointerDown = false;
        let currentTranslateX = 0;

        // Check if element is direct child or descendant of content container
        function isDirectChildOrDescendant(element) {
            let current = element;
            while (current && current !== document.body) {
                if (current.parentElement === this.contentContainer) {
                    return true;
                }
                current = current.parentElement;
            }
            return false;
        }

        // Add trackpad swipe support using pointer events
        this.uiContainer.addEventListener('pointerdown', (e) => {
            if (!this.isSwipeEnabled) return;
            if (!isDirectChildOrDescendant.call(this, e.target)) return;
            
            isPointerDown = true;
            lastPointerX = e.clientX;
            currentTranslateX = 0;
            this.uiContainer.style.transition = 'none';
        }, { passive: true });

        this.uiContainer.addEventListener('pointermove', (e) => {
            if (!this.isSwipeEnabled || !isPointerDown) return;
            
            const deltaX = e.clientX - lastPointerX;
            currentTranslateX += deltaX;
            
            // Limit movement to left only
            currentTranslateX = Math.max(-200, Math.min(0, currentTranslateX));
            
            // Apply transformation
            this.uiContainer.style.transform = `translateX(${currentTranslateX}px)`;
            
            lastPointerX = e.clientX;
        }, { passive: true });

        this.uiContainer.addEventListener('pointerup', (e) => {
            if (!isPointerDown) return;
            isPointerDown = false;
            
            // Re-enable animation
            this.uiContainer.style.transition = 'transform 0.3s ease-out';
            
            // Determine if UI should be hidden
            if (currentTranslateX < -SWIPE_THRESHOLD) {
                this.hide();
                this.showHint();
            } else {
                // Return to original position without showing
                this.uiContainer.style.transform = 'translateX(0)';
            }
        }, { passive: true });

        this.uiContainer.addEventListener('pointercancel', (e) => {
            if (!isPointerDown) return;
            isPointerDown = false;
            this.uiContainer.style.transition = 'transform 0.3s ease-out';
            // Return to original position without showing
            this.uiContainer.style.transform = 'translateX(0)';
        }, { passive: true });

        this.uiContainer.addEventListener('touchstart', (e) => {
            if (!this.isSwipeEnabled) return;
            if (!isDirectChildOrDescendant.call(this, e.target)) return;
            
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

            // Skip if too little time has passed since last movement
            if (timeDiff < 16) return; // ~60fps

            touchEndX = e.touches[0].clientX;
            const diff = touchStartX - touchEndX;
            
            // Consider it a swipe if finger moved far enough
            if (Math.abs(diff) > 10) {
                isSwiping = true;
            }
            
            // If swiping left, move UI exactly with the finger
            if (diff > 0 && isSwiping) {
                // Add smoothness to movement
                const velocity = diff / timeDiff;
                const smoothDiff = diff * (1 + velocity * 0.1);
                this.uiContainer.style.transform = `translateX(${-smoothDiff}px)`;
            }
        }, { passive: true });

        this.uiContainer.addEventListener('touchend', (e) => {
            if (!this.isSwipeEnabled) return;
            const diff = touchStartX - touchEndX;
            const timeDiff = Date.now() - startTime;
            const velocity = diff / timeDiff;
            
            // If it was a swipe and swipe was long enough or fast enough
            if (isSwiping && (diff > SWIPE_THRESHOLD || velocity > 0.5)) {
                this.uiContainer.style.transition = 'transform 0.3s ease-out';
                this.uiContainer.style.transform = 'translateX(-200vw)';
                this.isVisible = false;
                this.showHint();
            } else {
                // Otherwise return to original position with animation
                this.uiContainer.style.transition = 'transform 0.3s ease-out';
                this.uiContainer.style.transform = 'translateX(0)';
            }

            // Reset transition after animation
            setTimeout(() => {
                this.uiContainer.style.transition = '';
            }, 300);
        }, { passive: true });
    }

    setupEdgeTapShow() {
        const EDGE_THRESHOLD = 20; // Distance from screen edge for activation

        document.addEventListener('pointerdown', (e) => {
            if (this.isVisible) return; // If container is already visible, do nothing

            const touchX = e.clientX;
            
            // If tap was within screen edge
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
        this.contentContainer.appendChild(component.element);
    }

    // Remove a test component
    removeComponent(name) {
        const component = this.components.get(name);
        if (component) {
            this.contentContainer.removeChild(component.element);
            this.components.delete(name);
        }
    }

    // Show all UI components
    show() {
        this.uiContainer.style.transform = 'translateX(0)';
        this.isVisible = true;
        localStorage.setItem('yaga-ui-visible', 'true'); // Save state
    }

    // Hide all UI components
    hide() {
        this.uiContainer.style.transform = 'translateX(-200vw)';
        this.isVisible = false;
        localStorage.setItem('yaga-ui-visible', 'false'); // Save state
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
        // Remove previous hint if exists
        const oldHint = document.getElementById('yaga-hint');
        if (oldHint) oldHint.remove();

        // Create new hint
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

        // Hide hint after 2 seconds
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