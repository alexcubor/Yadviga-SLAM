class CacheManager {
    constructor() {
        this.onClear = null;
        this.isMinimized = true;
        this.cacheTypes = this.initializeCacheTypes();
        this.loadCheckboxStates();
    }

    initializeCacheTypes() {
        return [
            { 
                id: 'webStorage', 
                name: 'Web Storage', 
                clear: this.clearWebStorage.bind(this),
                getInfo: async () => {
                    const localStorageCount = Object.keys(localStorage).length;
                    const sessionStorageCount = Object.keys(sessionStorage).length;
                    return `${localStorageCount + sessionStorageCount} items`;
                },
                defaultChecked: false
            },
            { 
                id: 'jsCache', 
                name: 'JavaScript Cache', 
                clear: this.clearJSCache.bind(this),
                getInfo: async () => {
                    const scripts = Array.from(document.scripts);
                    const cachedScripts = scripts.filter(script => {
                        const url = script.src;
                        return url && !url.startsWith('data:') && !url.startsWith('blob:');
                    });
                    return `${cachedScripts.length} files`;
                },
                defaultChecked: true
            },
            { 
                id: 'indexedDB', 
                name: 'IndexedDB', 
                clear: this.clearIndexedDB.bind(this),
                getInfo: async () => {
                    const databases = await window.indexedDB.databases();
                    return `${databases.length} databases`;
                },
                defaultChecked: true
            },
            { 
                id: 'cacheStorage', 
                name: 'Cache Storage', 
                clear: this.clearCacheStorage.bind(this),
                getInfo: async () => {
                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        return `${cacheNames.length} caches`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'appCache', 
                name: 'Application Cache', 
                clear: this.clearAppCache.bind(this),
                getInfo: async () => {
                    return 'applicationCache' in window ? 'Available' : 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'wasm', 
                name: 'WebAssembly', 
                clear: this.clearWasm.bind(this),
                getInfo: async () => {
                    return window.Module ? 'Active' : 'Not active';
                },
                defaultChecked: true
            },
            { 
                id: 'cookies', 
                name: 'Cookies', 
                clear: this.clearCookies.bind(this),
                getInfo: async () => {
                    return `${document.cookie.split(';').length} cookies`;
                },
                defaultChecked: true
            },
            { 
                id: 'fileSystem', 
                name: 'File System', 
                clear: this.clearFileSystem.bind(this),
                getInfo: async () => {
                    return 'showDirectoryPicker' in window ? 'Available' : 'Not supported';
                },
                defaultChecked: false
            },
            { 
                id: 'serviceWorkers', 
                name: 'Service Workers', 
                clear: this.clearServiceWorkers.bind(this),
                getInfo: async () => {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        return `${registrations.length} workers`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'webrtc', 
                name: 'WebRTC', 
                clear: this.clearWebRTC.bind(this),
                getInfo: async () => {
                    return 'Automatically cleared on page unload';
                },
                defaultChecked: true
            },
            { 
                id: 'push', 
                name: 'Push Subscriptions', 
                clear: this.clearPush.bind(this),
                getInfo: async () => {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        let count = 0;
                        for (const reg of registrations) {
                            const subscription = await reg.pushManager.getSubscription();
                            if (subscription) count++;
                        }
                        return `${count} subscriptions`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'backgroundSync', 
                name: 'Background Sync', 
                clear: this.clearBackgroundSync.bind(this),
                getInfo: async () => {
                    return 'serviceWorker' in navigator ? 'Available' : 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'notifications', 
                name: 'Notifications', 
                clear: this.clearNotifications.bind(this),
                getInfo: async () => {
                    if ('permissions' in navigator) {
                        const result = await navigator.permissions.query({ name: 'notifications' });
                        return `Permission: ${result.state}`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'geolocation', 
                name: 'Geolocation', 
                clear: this.clearGeolocation.bind(this),
                getInfo: async () => {
                    if ('permissions' in navigator) {
                        const result = await navigator.permissions.query({ name: 'geolocation' });
                        return `Permission: ${result.state}`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'mediaDevices', 
                name: 'Media Devices', 
                clear: this.clearMediaDevices.bind(this),
                getInfo: async () => {
                    if ('permissions' in navigator) {
                        const result = await navigator.permissions.query({ name: 'camera' });
                        return `Permission: ${result.state}`;
                    }
                    return 'Not supported';
                },
                defaultChecked: true
            },
            { 
                id: 'permissions', 
                name: 'Permissions', 
                clear: this.clearPermissions.bind(this),
                getInfo: async () => {
                    return 'permissions' in navigator ? 'Available' : 'Not supported';
                },
                defaultChecked: true
            }
        ];
    }

    // UI Components
    createUI() {
        const cacheUI = this.createCacheUI();
        window.testContainer.addComponent('cache-manager', {
            element: cacheUI
        });
    }

    createCacheUI() {
        const cacheUI = document.createElement('div');
        Object.assign(cacheUI.style, {
            minWidth: '17rem',
            minHeight: '10rem',
        });

        const title = this.createTitle();
        const cacheList = this.createCacheList();
        const clearButton = this.createClearButton();
        const minimizeButton = this.createMinimizeButton(cacheUI, cacheList, title);

        title.appendChild(minimizeButton);
        cacheUI.appendChild(title);
        cacheUI.appendChild(cacheList);
        cacheUI.appendChild(clearButton);

        if (this.isMinimized) {
            this.minimizeUI(cacheUI, cacheList, title);
        }

        return cacheUI;
    }

    createTitle() {
        const title = document.createElement('div');
        title.textContent = 'Cache & Data Manager';
        Object.assign(title.style, {
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });
        return title;
    }

    createCacheList() {
        const cacheList = document.createElement('div');
        Object.assign(cacheList.style, {
            borderRadius: '0.375rem',
            marginBottom: '0.5rem',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '1rem',
            transition: 'all 0.3s ease'
        });
        this.cacheTypes.forEach(type => {
            const item = this.createCacheTypeItem(type);
            cacheList.appendChild(item);
        });

        return cacheList;
    }

    createCacheTypeItem(type) {
        const item = document.createElement('div');
        Object.assign(item.style, {
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            cursor: 'pointer',
            borderRadius: '0.375rem',
            marginBottom: '0.5rem',
            transition: 'background-color 0.2s'
        });

        const checkbox = this.createCheckbox(type);
        const label = this.createLabel(type);
        const info = this.createInfo(type);

        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(info);

        return item;
    }

    createCheckbox(type) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = type.id;
        Object.assign(checkbox.style, {
            marginRight: '0.75rem',
        });
        checkbox.checked = type.defaultChecked;
        checkbox.onchange = () => this.saveCheckboxStates();
        return checkbox;
    }

    createLabel(type) {
        const label = document.createElement('label');
        label.htmlFor = type.id;
        label.textContent = type.name;
        Object.assign(label.style, {
            flex: '1',
            cursor: 'pointer'
        });
        return label;
    }

    createInfo(type) {
        const info = document.createElement('span');
        info.id = `${type.id}-info`;
        Object.assign(info.style, {
            marginLeft: '0.75rem',
            color: '#aaa',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            transition: 'all 0.2s'
        });

        if (['webStorage', 'cookies', 'jsCache'].includes(type.id)) {
            this.styleInfoButton(info);
        }

        info.onclick = () => this.handleInfoClick(type, info);
        return info;
    }

    styleInfoButton(info) {
        Object.assign(info.style, {
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
        });

        const icon = document.createElement('span');
        icon.textContent = 'Reading...';
        info.prepend(icon);

        info.onmouseover = () => info.style.backgroundColor = 'rgba(255,255,255,0.3)';
        info.onmouseout = () => info.style.backgroundColor = 'rgba(255,255,255,0.2)';
    }

    createClearButton() {
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear & Reload';
        Object.assign(clearButton.style, {
            padding: '0.75rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem',
            width: '100%',
        });

        clearButton.onclick = async () => {
            const selectedTypes = this.cacheTypes.filter(type => 
                document.getElementById(type.id).checked
            );

            if (selectedTypes.length === 0) return;

            try {
                for (const type of selectedTypes) {
                    await type.clear();
                }

                if (this.onClear) {
                    this.onClear();
                }

                window.location.reload(true);
            } catch (err) {
                console.error('Error clearing data:', err);
            }
        };

        return clearButton;
    }

    createMinimizeButton(cacheUI, cacheList, title) {
        const minimizeButton = document.createElement('button');
        minimizeButton.innerHTML = this.isMinimized ? '+' : '−';
        Object.assign(minimizeButton.style, {
            width: '3rem',
            height: '1.5rem',
            padding: '0',
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
        });

        minimizeButton.onmouseover = () => minimizeButton.style.background = 'rgba(255,255,255,0.3)';
        minimizeButton.onmouseout = () => minimizeButton.style.background = 'rgba(255,255,255,0.2)';

        minimizeButton.onclick = () => {
            this.isMinimized = !this.isMinimized;
            if (this.isMinimized) {
                this.minimizeUI(cacheUI, cacheList, title);
                minimizeButton.innerHTML = '+';
            } else {
                this.maximizeUI(cacheUI, cacheList, title);
                minimizeButton.innerHTML = '−';
            }
            this.saveCheckboxStates();
        };

        return minimizeButton;
    }

    minimizeUI(cacheUI, cacheList, title) {
        Object.assign(cacheUI.style, {
            height: 'auto',
            minHeight: 'auto',
        });
        Object.assign(cacheList.style, {
            display: 'none',
            opacity: '0'
        });
        Object.assign(title.style, {
            marginBottom: '0.5rem'
        });
    }

    maximizeUI(cacheUI, cacheList, title) {
        Object.assign(cacheUI.style, {
            height: '',
            minHeight: '10rem',
        });
        Object.assign(cacheList.style, {
            display: '',
            opacity: '1'
        });
    }

    // Modal Windows
    createModalWindow(title) {
        const popup = document.createElement('div');
        const modalWidth = window.innerWidth - 50; // 10px from each side
        Object.assign(popup.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '1rem',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: '2000',
            width: `${modalWidth}px`,
            maxWidth: 'none',
            maxHeight: '80vh',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '1rem',
            color: 'white'
        });

        const titleElement = document.createElement('div');
        titleElement.textContent = title;
        Object.assign(titleElement.style, {
            fontWeight: 'bold',
            marginBottom: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '0.5rem'
        });
        popup.appendChild(titleElement);

        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: '1999'
        });

        const updateWidth = () => {
            popup.style.width = `${window.innerWidth - 20}px`;
        };
        window.addEventListener('resize', updateWidth);

        const cleanup = () => {
            window.removeEventListener('resize', updateWidth);
            overlay.removeEventListener('click', cleanup);
            popup.remove();
            overlay.remove();
        };
        overlay.addEventListener('click', cleanup);

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        return { popup, overlay, cleanup };
    }

    showWebStoragePopup() {
        const { popup } = this.createModalWindow('Web Storage Contents');

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '1rem',
            tableLayout: 'fixed'
        });

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        [
            { text: 'Storage', width: '15%' },
            { text: 'Key', width: '25%' },
            { text: 'Value', width: '60%' }
        ].forEach(({ text, width }) => {
            const th = document.createElement('th');
            th.textContent = text;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '0.5rem',
                borderBottom: '2px solid rgba(255,255,255,0.2)',
                width
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        // Add localStorage items
        Object.entries(localStorage).forEach(([key, value]) => {
            const row = document.createElement('tr');
            Object.assign(row.style, {
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            });

            const storageCell = document.createElement('td');
            storageCell.textContent = 'localStorage';
            Object.assign(storageCell.style, {
                padding: '0.5rem',
                color: '#4CAF50',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            const keyCell = document.createElement('td');
            keyCell.textContent = key;
            Object.assign(keyCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            Object.assign(valueCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            row.appendChild(storageCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });

        // Add sessionStorage items
        Object.entries(sessionStorage).forEach(([key, value]) => {
            const row = document.createElement('tr');
            Object.assign(row.style, {
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            });

            const storageCell = document.createElement('td');
            storageCell.textContent = 'sessionStorage';
            Object.assign(storageCell.style, {
                padding: '0.5rem',
                color: '#2196F3',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            const keyCell = document.createElement('td');
            keyCell.textContent = key;
            Object.assign(keyCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            Object.assign(valueCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            });

            row.appendChild(storageCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        popup.appendChild(table);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        Object.assign(closeButton.style, {
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            width: '100%'
        });
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);
    }

    showCookiesPopup() {
        const { popup } = this.createModalWindow('Cookies Contents');

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '1rem'
        });

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Name', 'Value', 'Domain', 'Path', 'Expires', 'Secure', 'HttpOnly'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '0.5rem',
                borderBottom: '2px solid rgba(255,255,255,0.2)'
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        const cookies = document.cookie.split(';').map(cookie => {
            const [name, ...rest] = cookie.trim().split('=');
            const value = rest.join('=');
            return { name, value };
        });

        cookies.forEach(cookie => {
            const row = document.createElement('tr');
            Object.assign(row.style, {
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            });

            const nameCell = document.createElement('td');
            nameCell.textContent = cookie.name;
            Object.assign(nameCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                color: '#4CAF50'
            });

            const valueCell = document.createElement('td');
            valueCell.textContent = cookie.value;
            Object.assign(valueCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace',
                maxWidth: '200px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
                overflow: 'hidden'
            });

            const domainCell = document.createElement('td');
            domainCell.textContent = window.location.hostname;
            Object.assign(domainCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace'
            });

            const pathCell = document.createElement('td');
            pathCell.textContent = '/';
            Object.assign(pathCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace'
            });

            const expiresCell = document.createElement('td');
            expiresCell.textContent = 'Session';
            Object.assign(expiresCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace'
            });

            const secureCell = document.createElement('td');
            secureCell.textContent = window.location.protocol === 'https:' ? 'Yes' : 'No';
            Object.assign(secureCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace'
            });

            const httpOnlyCell = document.createElement('td');
            httpOnlyCell.textContent = 'Unknown';
            Object.assign(httpOnlyCell.style, {
                padding: '0.5rem',
                fontFamily: 'monospace'
            });

            row.appendChild(nameCell);
            row.appendChild(valueCell);
            row.appendChild(domainCell);
            row.appendChild(pathCell);
            row.appendChild(expiresCell);
            row.appendChild(secureCell);
            row.appendChild(httpOnlyCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        popup.appendChild(table);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        Object.assign(closeButton.style, {
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            width: '100%'
        });
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);
    }

    showJSCachePopup() {
        const { popup } = this.createModalWindow('JavaScript Files Cache');

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '0.5rem',
            tableLayout: 'fixed'
        });

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        [
            { text: 'File', width: '40%' },
            { text: 'Status', width: '10%' },
            { text: 'Size', width: '10%' },
            { text: 'Modified', width: '40%' }
        ].forEach(({ text, width }) => {
            const th = document.createElement('th');
            th.textContent = text;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '0.25rem',
                borderBottom: '2px solid rgba(255,255,255,0.2)',
                width
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        const scripts = Array.from(document.scripts);
        scripts.forEach(script => {
            if (script.src) {
                const row = document.createElement('tr');
                Object.assign(row.style, {
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                });

                const fileCell = document.createElement('td');
                fileCell.textContent = script.src.split('/').pop();
                Object.assign(fileCell.style, {
                    padding: '0.25rem',
                    fontFamily: 'monospace',
                    color: '#4CAF50',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                });

                const statusCell = document.createElement('td');
                statusCell.textContent = 'Cached';
                Object.assign(statusCell.style, {
                    padding: '0.25rem',
                    fontFamily: 'monospace'
                });

                const sizeCell = document.createElement('td');
                sizeCell.textContent = 'Unknown';
                Object.assign(sizeCell.style, {
                    padding: '0.25rem',
                    fontFamily: 'monospace'
                });

                const modifiedCell = document.createElement('td');
                modifiedCell.textContent = 'Unknown';
                Object.assign(modifiedCell.style, {
                    padding: '0.25rem',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                });

                fetch(script.src, { method: 'HEAD' })
                    .then(response => {
                        if (response.ok) {
                            const size = response.headers.get('content-length');
                            const modified = response.headers.get('last-modified');
                            sizeCell.textContent = size ? `${(size / 1024).toFixed(1)} KB` : 'Unknown';
                            modifiedCell.textContent = modified || 'Unknown';
                        }
                    })
                    .catch(() => {
                        statusCell.textContent = 'Error';
                        statusCell.style.color = '#ff4444';
                    });

                row.appendChild(fileCell);
                row.appendChild(statusCell);
                row.appendChild(sizeCell);
                row.appendChild(modifiedCell);
                tbody.appendChild(row);
            }
        });

        table.appendChild(tbody);
        popup.appendChild(table);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        Object.assign(closeButton.style, {
            padding: '0.25rem 0.5rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
        });
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);
    }

    // State Management
    loadCheckboxStates() {
        try {
            const savedStates = localStorage.getItem('cache_manager_states');
            if (savedStates) {
                const states = JSON.parse(savedStates);
                this.cacheTypes.forEach(type => {
                    if (states[type.id] !== undefined) {
                        type.defaultChecked = states[type.id];
                    }
                });
                if (states.minimized !== undefined) {
                    this.isMinimized = states.minimized;
                }
            } else {
                this.cacheTypes.forEach(type => {
                    if (type.id === 'fileSystem') {
                        type.defaultChecked = false;
                    }
                });
            }
        } catch (err) {
            console.warn('Error loading checkbox states:', err);
            this.cacheTypes.forEach(type => {
                if (type.id === 'fileSystem') {
                    type.defaultChecked = false;
                }
            });
        }
    }

    saveCheckboxStates() {
        try {
            const states = {};
            this.cacheTypes.forEach(type => {
                const checkbox = document.getElementById(type.id);
                if (checkbox) {
                    states[type.id] = checkbox.checked;
                }
            });
            states.minimized = this.isMinimized;
            localStorage.setItem('cache_manager_states', JSON.stringify(states));
        } catch (err) {
            console.warn('Error saving checkbox states:', err);
        }
    }

    // Event Handlers
    async handleInfoClick(type, info) {
        try {
            switch(type.id) {
                case 'webStorage':
                    this.showWebStoragePopup();
                    break;
                case 'cookies':
                    this.showCookiesPopup();
                    break;
                case 'jsCache':
                    this.showJSCachePopup();
                    break;
                default:
                    const result = await type.getInfo();
                    info.textContent = result;
                    setTimeout(() => {
                        info.style.color = '#aaa';
                    }, 2000);
            }
        } catch (err) {
            info.textContent = 'Error';
            info.style.color = '#ff4444';
            setTimeout(() => {
                info.style.color = '#aaa';
            }, 2000);
        }
    }

    // Initialization
    async init() {
        this.createUI();
        this.startInfoUpdates();
    }

    startInfoUpdates() {
        setInterval(async () => {
            for (const type of this.cacheTypes) {
                const infoElement = document.getElementById(`${type.id}-info`);
                if (infoElement) {
                    try {
                        infoElement.textContent = await type.getInfo();
                    } catch (err) {
                        infoElement.textContent = 'Error';
                    }
                }
            }
        }, 1000);
    }

    // Clear Methods
    async clearWebStorage() {
        window.localStorage.clear();
        window.sessionStorage.clear();
    }

    async clearIndexedDB() {
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
            await window.indexedDB.deleteDatabase(db.name);
        }
    }

    async clearCacheStorage() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
    }

    async clearAppCache() {
        if ('applicationCache' in window) {
            window.applicationCache.abort();
        }
    }

    async clearWasm() {
        if (window.Module) {
            window.Module._clearMemory?.();
        }
    }

    async clearCookies() {
        document.cookie.split(';').forEach(cookie => {
            document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
        });
    }

    async clearFileSystem() {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file') {
                        await entry.remove();
                    }
                }
            } catch (err) {
                console.warn('File system access denied:', err);
            }
        }
    }

    async clearServiceWorkers() {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
        }
    }

    async clearWebRTC() {
        console.warn('WebRTC connections are automatically closed when the page is unloaded');
    }

    async clearPush() {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                const subscription = await reg.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                }
            }
        }
    }

    async clearBackgroundSync() {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                if ('sync' in reg) {
                    await reg.sync.unregister('sync-tag');
                }
            }
        }
    }

    async clearNotifications() {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'notifications' });
            if (result.state === 'granted') {
                console.warn('Notification permissions can only be revoked in browser settings');
            }
        }
    }

    async clearGeolocation() {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
                console.warn('Geolocation permissions can only be revoked in browser settings');
            }
        }
    }

    async clearMediaDevices() {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'camera' });
            if (result.state === 'granted') {
                console.warn('Media device permissions can only be revoked in browser settings');
            }
        }
    }

    async clearPermissions() {
        if ('permissions' in navigator) {
            console.warn('Permissions can only be revoked in browser settings');
        }
    }

    async clearJSCache() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        const scripts = Array.from(document.scripts);
        scripts.forEach(script => {
            if (script.src) {
                const url = new URL(script.src);
                url.searchParams.set('t', Date.now());
                script.src = url.toString();
            }
        });
    }
}

// Export for use in other files
window.CacheManager = CacheManager;

// Initialize when YAGA is ready
(function() {
    const observer = new MutationObserver((mutations) => {
        if (window.YAGA) {
            observer.disconnect();
            if (window.testContainer) {
                console.log('🧹 Enable dev-tool-cache.js');
                const cacheManager = new CacheManager();
                cacheManager.init();
            } else {
                console.log('🧹 Enable dev-tool-cache.js ❌ (Please connect dev-desktop.js first)');
            }
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
})();

// Set base font size
const isDesktop = /Win|Mac|Linux|X11|CrOS/.test(navigator.platform);
document.documentElement.style.setProperty('font-size', isDesktop ? '0.6rem' : '1rem', 'important');
