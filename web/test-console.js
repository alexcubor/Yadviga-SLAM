// Early console override to capture logs before UI creation
const earlyLogs = [];
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Check if running on desktop
window.isDesktop = !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

// Add initial message only for desktop users
if (window.isDesktop) {
    earlyLogs.push({ 
        type: 'info', 
        message: 'Disabled for desktop browsers. Please use native DevTools console.',
        count: 1 
    });
} else {
    // For mobile, start capturing logs immediately
    const addEarlyLog = (type, args) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        earlyLogs.push({ type, message, count: 1 });
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
}

class ConsoleUI {
    constructor() {
        this.logs = [...earlyLogs]; // Initialize with early logs
        this.maxLogs = 100; // Maximum number of logs to keep
        this.isUserScrolling = false;
        this.loadDimensions();
        this.createUI();
        if (!window.isDesktop) {
            this.overrideConsole();
        }
        // Add initial display update
        this.updateDisplay();
    }

    loadDimensions() {
        try {
            const savedDimensions = localStorage.getItem('console_dimensions');
            if (savedDimensions) {
                const parsed = JSON.parse(savedDimensions);
                // Ensure we have valid pixel values
                this.dimensions = {
                    width: parsed.width || '320px',
                    maxWidth: 'none',
                    height: parsed.height || '250px'
                };
            } else {
                // Get UI container width for default size
                const uiContainer = document.getElementById('yaga-ui-container');
                const defaultWidth = uiContainer ? `${uiContainer.offsetWidth}px` : '320px';
                
                this.dimensions = {
                    width: defaultWidth,
                    maxWidth: 'none',
                    height: '250px'
                };
            }
        } catch (err) {
            console.warn('Error loading console dimensions:', err);
            // Get UI container width for default size
            const uiContainer = document.getElementById('yaga-ui-container');
            const defaultWidth = uiContainer ? `${uiContainer.offsetWidth}px` : '320px';
            
            this.dimensions = {
                width: defaultWidth,
                maxWidth: 'none',
                height: '250px'
            };
        }
    }

    saveDimensions() {
        try {
            // Ensure we're saving pixel values
            const dimensionsToSave = {
                width: this.dimensions.width,
                maxWidth: 'none',
                height: this.dimensions.height
            };
            localStorage.setItem('console_dimensions', JSON.stringify(dimensionsToSave));
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
            uiContainer.style.fontSize = '1rem';
            uiContainer.style.fontFamily = 'monospace';
            document.body.appendChild(uiContainer);
        }

        // Create console container
        const consoleContainer = document.createElement('div');
        consoleContainer.style.width = window.isDesktop ? 'auto' : this.dimensions.width;
        consoleContainer.style.maxWidth = window.isDesktop ? 'none' : this.dimensions.maxWidth;
        consoleContainer.style.height = window.isDesktop ? 'auto' : this.dimensions.height;
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

        // Add resize handle only for mobile
        if (!window.isDesktop) {
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
            consoleContainer.appendChild(resizeHandle);

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
                let newWidth = Math.max(startWidth + deltaX, 320); // Minimum width 320px
                let newHeight = Math.max(startHeight + deltaY, 250); // Minimum height 160px

                // Apply max height constraint
                const maxHeight = window.innerHeight * 0.8;
                if (newHeight > maxHeight) {
                    newHeight = maxHeight;
                }

                // Update dimensions
                consoleContainer.style.width = `${newWidth}px`;
                consoleContainer.style.height = `${newHeight}px`;

                // Save dimensions with pixel units
                this.dimensions = {
                    width: `${newWidth}px`,
                    maxWidth: 'none',
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
        }

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
        consoleTitle.textContent = 'Mobile Console';
        consoleTitle.style.fontWeight = '500';
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.padding = '0.25rem 0.5rem';
        copyButton.style.borderRadius = '0.25rem';
        copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
        copyButton.style.border = 'none';
        copyButton.style.color = 'white';
        copyButton.style.cursor = 'pointer';
        copyButton.style.fontSize = '1rem';
        copyButton.onclick = (e) => {
            e.stopPropagation(); // Prevent console click event
            const text = this.logs.map(log => {
                const count = log.count > 1 ? ` (${log.count})` : '';
                return `${log.message}${count}`;
            }).join('\n');
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                copyButton.style.backgroundColor = 'rgba(0,255,0,0.2)';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                copyButton.textContent = 'Error!';
                copyButton.style.backgroundColor = 'rgba(255,0,0,0.2)';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                    copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }, 1000);
            });
        };

        consoleHeader.appendChild(consoleTitle);
        consoleHeader.appendChild(copyButton);

        // Create console content
        const consoleContent = document.createElement('div');
        consoleContent.style.flex = '1';
        consoleContent.style.overflowY = window.isDesktop ? 'hidden' : 'auto';
        consoleContent.style.padding = '0.5rem';
        consoleContent.style.backgroundColor = 'rgba(0,0,0,0.2)';
        consoleContent.style.borderRadius = '0.375rem';
        consoleContent.style.fontSize = '1rem';
        consoleContent.style.whiteSpace = 'pre-wrap';
        consoleContent.style.wordBreak = 'break-word';
        consoleContent.style.lineHeight = window.isDesktop ? '1.2' : '1.5';

        // Add scroll event listener only for mobile
        if (!window.isDesktop) {
            let touchStartY = 0;
            let isTouching = false;
            let isScrolling = false;

            consoleContent.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                isTouching = true;
                isScrolling = false;
            });

            consoleContent.addEventListener('touchmove', (e) => {
                if (isTouching) {
                    const currentY = e.touches[0].clientY;
                    const deltaY = Math.abs(currentY - touchStartY);
                    
                    // Only consider it scrolling if moved more than 5 pixels
                    if (deltaY > 5) {
                        isScrolling = true;
                        this.isUserScrolling = true;
                    }
                }
            });

            consoleContent.addEventListener('touchend', () => {
                isTouching = false;
                // Only check bottom position if we were actually scrolling
                if (isScrolling) {
                    const isAtBottom = consoleContent.scrollHeight - consoleContent.scrollTop <= consoleContent.clientHeight + 1;
                    this.isUserScrolling = !isAtBottom;
                }
            });

            consoleContent.addEventListener('scroll', () => {
                const isAtBottom = consoleContent.scrollHeight - consoleContent.scrollTop <= consoleContent.clientHeight + 1;
                this.isUserScrolling = !isAtBottom;
            });
        }

        consoleContainer.appendChild(consoleHeader);
        consoleContainer.appendChild(consoleContent);
        uiContainer.appendChild(consoleContainer);

        this.consoleContent = consoleContent;
        
        // Add initial display update after console content is created
        this.updateDisplay();
    }

    overrideConsole() {
        const addLog = (type, args) => {
            // If we've reached max logs, don't add any more
            if (this.logs.length >= this.maxLogs) {
                return;
            }

            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            // Check if the last log is the same
            const lastLog = this.logs[this.logs.length - 1];
            if (lastLog && lastLog.message === message && lastLog.type === type) {
                lastLog.count = (lastLog.count || 1) + 1;
            } else {
                this.logs.push({ type, message, count: 1 });
                
                // If we've reached max logs, add the message and restore original console
                if (this.logs.length >= this.maxLogs) {
                    // Restore original console methods
                    console.log = originalConsole.log;
                    console.error = originalConsole.error;
                    console.warn = originalConsole.warn;
                    console.info = originalConsole.info;
                    
                    // Add the message at the very end
                    this.logs.push({ type: 'warn', message: "Too many logs...", count: 1 });
                }
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

        // Сохраняем текущее выделение
        const selection = window.getSelection();
        const selectedText = selection.toString();
        const isSelecting = selectedText.length > 0;

        // Если есть выделение, не обновляем консоль
        if (isSelecting) return;

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

            return `<div style="color: ${color};">${log.message}${countHtml}</div>`;
        }).join('');

        this.consoleContent.innerHTML = html;
        
        // Only auto-scroll if user is at the bottom
        if (!this.isUserScrolling) {
            requestAnimationFrame(() => {
                this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
            });
        }
    }

    clearLogs() {
        this.logs = [];
        this.updateDisplay();
    }
}

// Initialize console UI immediately
console.log('📝 Enable test-console.js');
window.consoleUI = new ConsoleUI();

window.isDesktop = window.isDesktop !== undefined ? window.isDesktop : !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
