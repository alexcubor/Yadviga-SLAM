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
        type: 'log', 
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
        this.isResizing = false; // Добавляем флаг для отслеживания изменения размера
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
        // Ensure test container exists
        if (!window.testContainer) {
            console.warn('Test container not found, creating temporary container');
            window.testContainer = {
                addComponent: (name, component) => {
                    document.body.appendChild(component.element);
                }
            };
        }

        // Create console container
        const consoleContainer = document.createElement('div');
        consoleContainer.style.minWidth = '20rem';
        consoleContainer.style.height = window.isDesktop ? 'auto' : 'fit-content';
        consoleContainer.style.willChange = 'width, height';
        consoleContainer.style.transform = 'translateZ(0)';
        consoleContainer.style.display = 'flex';
        consoleContainer.style.flexDirection = 'column';

        // Add resize handle only for mobile
        if (!window.isDesktop) {
            const resizeHandle = document.createElement('div');
            Object.assign(resizeHandle.style, {
                position: 'absolute',
                right: '0',
                bottom: '0',
                width: '2rem',
                height: '2rem',
                cursor: 'nwse-resize',
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)',
                borderRadius: '0 0 0.5rem 0',
                touchAction: 'none',
                zIndex: '1000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)'
            });

            consoleContainer.appendChild(resizeHandle);

            // Resize functionality
            let startX, startY, startWidth, startHeight;

            const startResize = (clientX, clientY) => {
                this.isResizing = true;
                if (window.testContainer) {
                    window.testContainer.disableSwipe();
                }
                startX = clientX;
                startY = clientY;
                startWidth = consoleContainer.offsetWidth;
                startHeight = consoleContainer.offsetHeight;
                
                // Add active state styles
                resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.4) 50%)';
                resizeHandle.style.color = 'rgba(255,255,255,0.9)';
            };

            const doResize = (clientX, clientY) => {
                if (!this.isResizing) return;

                const deltaX = clientX - startX;
                const deltaY = clientY - startY;
                
                // Calculate new dimensions
                let newWidth = Math.max(startWidth + deltaX, 320);
                let newHeight = Math.max(startHeight + deltaY, 250);

                // Apply max height constraint
                const maxHeight = window.innerHeight * 0.8;
                if (newHeight > maxHeight) {
                    newHeight = maxHeight;
                }

                // Update dimensions
                consoleContainer.style.width = `${newWidth}px`;
                consoleContainer.style.height = `${newHeight}px`;
                consoleContent.style.height = `${newHeight - consoleHeader.offsetHeight - 8}px`; // 8px для отступов

                // Save dimensions with pixel units
                this.dimensions = {
                    width: `${newWidth}px`,
                    maxWidth: 'none',
                    height: `${newHeight}px`
                };
                this.saveDimensions();
            };

            const stopResize = () => {
                if (!this.isResizing) return;
                this.isResizing = false;
                if (window.testContainer) {
                    window.testContainer.enableSwipe();
                }
                
                // Reset styles
                resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)';
                resizeHandle.style.color = 'rgba(255,255,255,0.5)';
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
                if (this.isResizing) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    doResize(touch.clientX, touch.clientY);
                }
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
        consoleHeader.style.touchAction = 'none';

        const consoleTitle = document.createElement('span');
        consoleTitle.textContent = 'Mobile Console';
        consoleTitle.style.fontWeight = '500';
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.padding = '0.25rem 0.5rem';
        copyButton.style.borderRadius = '0.25rem';
        copyButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
        copyButton.style.border = 'none';
        copyButton.style.cursor = 'pointer';
        copyButton.style.fontSize = '1rem';
        copyButton.onclick = (e) => {
            e.stopPropagation();
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
        consoleContent.style.height = window.isDesktop ? 'auto' : 'fit-content';
        consoleContent.style.padding = '0.5rem';
        consoleContent.style.touchAction = 'pan-y';
        
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

        // Store references
        this.element = consoleContainer;
        this.content = consoleContent;
        this.header = consoleHeader;

        // Add to test container
        window.testContainer.addComponent('console', this);
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
        if (!this.content) return;

        // Сохраняем текущее выделение
        const selection = window.getSelection();
        const selectedText = selection.toString();
        const isSelecting = selectedText.length > 0;

        // Если есть выделение, не обновляем консоль
        if (isSelecting) return;

        const logStyles = {
            log: { color: '#fff', background: 'none', padding: '0rem' },
            error: { color: '#ff6b6b', background: 'none', padding: '0rem' },
            warn: { color: '#ffd93d', background: 'none', padding: '0rem' },
            info: { color: '#4dabf7', background: 'none', padding: '0rem' }
        };

        const html = this.logs.map(log => {
            const style = logStyles[log.type];
            const styleString = Object.entries(style)
                .map(([key, value]) => `${key}: ${value}`)
                .join('; ');

            const countHtml = log.count > 1 
                ? `<span style="color: #999; margin-left: 0.5rem;">(${log.count})</span>` 
                : '';

            return `<div style="${styleString}">${log.message}${countHtml}</div>`;
        }).join('');

        this.content.innerHTML = html;
        
        // Only auto-scroll if user is at the bottom
        if (!this.isUserScrolling) {
            requestAnimationFrame(() => {
                this.content.scrollTop = this.content.scrollHeight;
            });
        }
    }

    init() {
        // Create console container
        const consoleContainer = document.createElement('div');

        // Create header
        const header = document.createElement('div');

        // Create title
        const title = document.createElement('div');
        title.textContent = 'Test Console';
        header.appendChild(title);

        // Create controls
        const controls = document.createElement('div');

        header.appendChild(controls);
        consoleContainer.appendChild(header);

        // Store references
        this.element = consoleContainer;
        this.content = content;
        this.header = header;

        // Add to test container
        window.testContainer.addComponent('console', this);

        // Setup drag functionality
        this.setupDrag();
    }
}

// Initialize console UI immediately
if (window.testContainer) {
    console.log('📝 Enable test-console.js');
    window.consoleUI = new ConsoleUI();
} else {
    console.log('📝 Enable test-console.js (Please connect dev-desktop.js first)');
}

// Добавляем обработчик для блокировки свайпа во время изменения размера
if (window.testContainer && window.testContainer.uiContainer) {
    const originalTouchMove = window.testContainer.uiContainer.ontouchmove;
    window.testContainer.uiContainer.ontouchmove = (e) => {
        if (window.consoleUI && window.consoleUI.isResizing) {
            e.preventDefault();
            return;
        }
        if (originalTouchMove) {
            originalTouchMove.call(window.testContainer.uiContainer, e);
        }
    };
}
