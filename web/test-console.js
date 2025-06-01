// Early console override to capture logs before UI creation
const earlyLogs = [];
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

const addEarlyLog = (type, args) => {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    earlyLogs.push({ type, timestamp, message, count: 1 });
};

console.log = (...args) => {
    originalConsole.log.apply(console, args);
    addEarlyLog('log', args);
};

console.error = (...args) => {
    originalConsole.error.apply(console, args);
    addEarlyLog('error', args);
};

console.warn = (...args) => {
    originalConsole.warn.apply(console, args);
    addEarlyLog('warn', args);
};

console.info = (...args) => {
    originalConsole.info.apply(console, args);
    addEarlyLog('info', args);
};

class ConsoleUI {
    constructor() {
        this.logs = [...earlyLogs]; // Initialize with early logs
        this.maxLogs = 1000; // Maximum number of logs to keep
        this.isUserScrolling = false;
        this.showTimestamps = false; // Initialize timestamp state
        this.loadDimensions();
        this.createUI();
        this.overrideConsole();
        // Add initial display update
        this.updateDisplay();
    }

    loadDimensions() {
        try {
            const savedDimensions = localStorage.getItem('console_dimensions');
            if (savedDimensions) {
                this.dimensions = JSON.parse(savedDimensions);
            } else {
                this.dimensions = {
                    width: '90vw',
                    maxWidth: '40rem',
                    height: '30vh'
                };
            }
        } catch (err) {
            console.warn('Error loading console dimensions:', err);
            this.dimensions = {
                width: '90vw',
                maxWidth: '40rem',
                height: '30vh'
            };
        }
    }

    saveDimensions() {
        try {
            localStorage.setItem('console_dimensions', JSON.stringify(this.dimensions));
        } catch (err) {
            console.warn('Error saving console dimensions:', err);
        }
    }

    createUI() {
        // Get or create UI container
        let uiContainer = document.getElementById('yaga-ui-container');
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'yaga-ui-container';
            uiContainer.style.position = 'fixed';
            uiContainer.style.top = '2vh';
            uiContainer.style.left = '2vw';
            uiContainer.style.zIndex = '1000';
            uiContainer.style.display = 'flex';
            uiContainer.style.flexDirection = 'column';
            uiContainer.style.gap = '1rem';
            document.body.appendChild(uiContainer);
        }

        // Create console container
        const consoleContainer = document.createElement('div');
        consoleContainer.style.width = this.dimensions.width;
        consoleContainer.style.maxWidth = this.dimensions.maxWidth;
        consoleContainer.style.height = this.dimensions.height;
        consoleContainer.style.padding = '1rem';
        consoleContainer.style.borderRadius = '0.5rem';
        consoleContainer.style.color = 'white';
        consoleContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        consoleContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        consoleContainer.style.overflow = 'hidden';
        consoleContainer.style.display = 'flex';
        consoleContainer.style.flexDirection = 'column';
        consoleContainer.style.position = 'relative';
        consoleContainer.style.marginTop = 'auto'; // Push to bottom

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '0';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.width = '3rem';
        resizeHandle.style.height = '3rem';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)';
        resizeHandle.style.borderRadius = '0 0 0.5rem 0';
        resizeHandle.style.transition = 'all 0.2s';
        resizeHandle.style.touchAction = 'none';
        resizeHandle.style.zIndex = '1000';

        // Add visual indicator for touch
        const touchIndicator = document.createElement('div');
        touchIndicator.style.position = 'absolute';
        touchIndicator.style.right = '0.5rem';
        touchIndicator.style.bottom = '0.5rem';
        touchIndicator.style.width = '1.5rem';
        touchIndicator.style.height = '1.5rem';
        touchIndicator.style.background = 'rgba(255,255,255,0.1)';
        touchIndicator.style.borderRadius = '50%';
        touchIndicator.style.display = 'flex';
        touchIndicator.style.alignItems = 'center';
        touchIndicator.style.justifyContent = 'center';
        touchIndicator.style.color = 'rgba(255,255,255,0.5)';
        touchIndicator.textContent = '↔';
        touchIndicator.style.transform = 'rotate(45deg)';
        touchIndicator.style.transition = 'all 0.2s';

        resizeHandle.appendChild(touchIndicator);

        // Resize functionality
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const startResize = (clientX, clientY) => {
            isResizing = true;
            startX = clientX;
            startY = clientY;
            startWidth = consoleContainer.offsetWidth;
            startHeight = consoleContainer.offsetHeight;
            
            // Add active state styles
            resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.4) 50%)';
            touchIndicator.style.background = 'rgba(255,255,255,0.3)';
            touchIndicator.style.color = 'rgba(255,255,255,0.9)';
        };

        const doResize = (clientX, clientY) => {
            if (!isResizing) return;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            // Calculate new dimensions
            let newWidth = Math.max(startWidth + deltaX, 320); // 20rem = 320px
            let newHeight = Math.max(startHeight + deltaY, 160); // 10rem = 160px

            // Apply max width constraint
            if (newWidth > 512) { // 40rem = 512px
                newWidth = 512;
            }

            // Apply max height constraint
            const maxHeight = window.innerHeight * 0.8;
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
            }

            // Update dimensions
            consoleContainer.style.width = `${newWidth}px`;
            consoleContainer.style.height = `${newHeight}px`;

            // Save dimensions
            this.dimensions = {
                width: `${newWidth}px`,
                maxWidth: '40rem',
                height: `${newHeight}px`
            };
            this.saveDimensions();
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            
            // Reset styles
            resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)';
            touchIndicator.style.background = 'rgba(255,255,255,0.1)';
            touchIndicator.style.color = 'rgba(255,255,255,0.5)';
        };

        // Mouse events
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            doResize(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', stopResize);

        // Touch events
        resizeHandle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startResize(touch.clientX, touch.clientY);
        });

        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            doResize(touch.clientX, touch.clientY);
        });

        document.addEventListener('touchend', stopResize);
        document.addEventListener('touchcancel', stopResize);

        consoleContainer.appendChild(resizeHandle);

        // Create console header
        const consoleHeader = document.createElement('div');
        consoleHeader.style.display = 'flex';
        consoleHeader.style.justifyContent = 'space-between';
        consoleHeader.style.alignItems = 'center';
        consoleHeader.style.marginBottom = '0.5rem';
        consoleHeader.style.padding = '0.5rem';
        consoleHeader.style.backgroundColor = 'rgba(0,0,0,0.3)';
        consoleHeader.style.borderRadius = '0.375rem';

        const consoleTitle = document.createElement('span');
        consoleTitle.textContent = 'Console';
        consoleTitle.style.fontWeight = '500';
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        clearButton.style.padding = '0.25rem 0.5rem';
        clearButton.style.borderRadius = '0.25rem';
        clearButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
        clearButton.style.border = 'none';
        clearButton.style.color = 'white';
        clearButton.style.cursor = 'pointer';
        clearButton.style.fontSize = '1rem';
        clearButton.onclick = (e) => {
            e.stopPropagation(); // Prevent console click event
            this.clearLogs();
        };

        consoleHeader.appendChild(consoleTitle);
        consoleHeader.appendChild(clearButton);

        // Create console content
        const consoleContent = document.createElement('div');
        consoleContent.style.flex = '1';
        consoleContent.style.overflowY = 'auto';
        consoleContent.style.padding = '0.5rem';
        consoleContent.style.backgroundColor = 'rgba(0,0,0,0.2)';
        consoleContent.style.borderRadius = '0.375rem';
        consoleContent.style.fontSize = '1rem';
        consoleContent.style.whiteSpace = 'pre-wrap';
        consoleContent.style.wordBreak = 'break-word';
        consoleContent.style.cursor = 'pointer';

        // Add scroll event listener
        consoleContent.addEventListener('scroll', () => {
            const isAtBottom = consoleContent.scrollHeight - consoleContent.scrollTop <= consoleContent.clientHeight + 1;
            this.isUserScrolling = !isAtBottom;
        });

        // Add click event listener for timestamp toggle
        consoleContent.addEventListener('click', () => {
            this.showTimestamps = !this.showTimestamps;
            const timestamps = consoleContent.getElementsByClassName('timestamp');
            for (let ts of timestamps) {
                ts.style.display = this.showTimestamps ? 'inline' : 'none';
            }
        });

        consoleContainer.appendChild(consoleHeader);
        consoleContainer.appendChild(consoleContent);
        uiContainer.appendChild(consoleContainer);

        this.consoleContent = consoleContent;
        
        // Add initial display update after console content is created
        this.updateDisplay();
    }

    overrideConsole() {
        const addLog = (type, args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            // Check if the last log is the same
            const lastLog = this.logs[this.logs.length - 1];
            if (lastLog && lastLog.message === message && lastLog.type === type) {
                lastLog.count = (lastLog.count || 1) + 1;
                lastLog.timestamp = timestamp; // Update timestamp
            } else {
                this.logs.push({ type, timestamp, message, count: 1 });
            }

            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }

            this.updateDisplay();
        };

        console.log = (...args) => {
            originalConsole.log.apply(console, args);
            addLog('log', args);
        };

        console.error = (...args) => {
            originalConsole.error.apply(console, args);
            addLog('error', args);
        };

        console.warn = (...args) => {
            originalConsole.warn.apply(console, args);
            addLog('warn', args);
        };

        console.info = (...args) => {
            originalConsole.info.apply(console, args);
            addLog('info', args);
        };
    }

    updateDisplay() {
        if (!this.consoleContent) return;

        const html = this.logs.map(log => {
            const color = {
                log: '#fff',
                error: '#ff6b6b',
                warn: '#ffd93d',
                info: '#4dabf7'
            }[log.type];

            const countHtml = log.count > 1 
                ? `<span style="color: #999; margin-left: 0.5rem;">(${log.count})</span>` 
                : '';

            const timestampHtml = `<span class="timestamp" style="color: #aaa; margin-right: 0.5rem; display: ${this.showTimestamps ? 'inline' : 'none'};">[${log.timestamp}]</span>`;

            return `<div style="color: ${color};">${timestampHtml}${log.message}${countHtml}</div>`;
        }).join('');

        this.consoleContent.innerHTML = html;
        
        // Only auto-scroll if user is not manually scrolling
        if (!this.isUserScrolling) {
            this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
        }
    }

    clearLogs() {
        this.logs = [];
        this.updateDisplay();
    }
}

// Wrap observer in IIFE to avoid variable redeclaration
(function() {
    const observer = new MutationObserver((mutations) => {
        if (window.YAGA) {
            observer.disconnect();
            console.log('📝 Enable test-console.js');
            window.consoleUI = new ConsoleUI();
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
})();

window.isDesktop = window.isDesktop !== undefined ? window.isDesktop : /Win|Mac|Linux|X11|CrOS/.test(navigator.platform);
document.documentElement.style.setProperty('font-size', window.isDesktop ? '0.6rem' : '1rem', 'important');
