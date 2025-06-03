class CacheManager {
    constructor() {
        this.onClear = null;
        this.isMinimized = true;
        this.cacheTypes = [
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
                id: 'webgl', 
                name: 'WebGL Resources', 
                clear: this.clearWebGL.bind(this),
                getInfo: async () => {
                    return window._gl ? 'Active' : 'Not active';
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
                id: 'sharedWorkers', 
                name: 'Shared Workers', 
                clear: this.clearSharedWorkers.bind(this),
                getInfo: async () => {
                    return 'Shared workers can only be cleared by closing all tabs';
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

        // Load saved checkbox states
        this.loadCheckboxStates();
    }

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
                // Load minimized state
                if (states.minimized !== undefined) {
                    this.isMinimized = states.minimized;
                }
            } else {
                // If no saved states, force File System to be unchecked
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
            // Save minimized state
            states.minimized = this.isMinimized;
            localStorage.setItem('cache_manager_states', JSON.stringify(states));
        } catch (err) {
            console.warn('Error saving checkbox states:', err);
        }
    }

    async init() {
        this.createUI();
        this.startInfoUpdates();
    }

    startInfoUpdates() {
        // Update info every second
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

        const cacheUI = document.createElement('div');
        cacheUI.style.width = '90vw';
        cacheUI.style.maxWidth = '40rem';
        cacheUI.style.minWidth = '20rem';
        cacheUI.style.minHeight = '10rem';
        cacheUI.style.padding = '1rem';
        cacheUI.style.borderRadius = '0.5rem';
        cacheUI.style.color = 'white';
        cacheUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
        cacheUI.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        cacheUI.style.position = 'relative';
        cacheUI.style.overflow = 'auto';
        cacheUI.style.transition = 'all 0.3s ease';

        // Create title
        const title = document.createElement('div');
        title.textContent = 'Cache & Data Manager';
        title.style.marginBottom = '0.75rem';
        title.style.color = '#fff';
        title.style.lineHeight = '1.2';
        cacheUI.appendChild(title);

        // Create cache type list
        const cacheList = document.createElement('div');
        cacheList.className = 'cache-list';
        cacheList.style.backgroundColor = 'rgba(0,0,0,0.3)';
        cacheList.style.borderRadius = '0.375rem';
        cacheList.style.padding = '0.75rem';
        cacheList.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        cacheList.style.fontSize = '1rem';
        cacheList.style.transition = 'all 0.3s ease';

        // Add minimize button
        const minimizeButton = document.createElement('button');
        minimizeButton.innerHTML = this.isMinimized ? '+' : '−';
        minimizeButton.style.position = 'absolute';
        minimizeButton.style.top = '0.5rem';
        minimizeButton.style.right = '0.5rem';
        minimizeButton.style.width = '1.5rem';
        minimizeButton.style.height = '1.5rem';
        minimizeButton.style.padding = '0';
        minimizeButton.style.border = 'none';
        minimizeButton.style.background = 'rgba(255,255,255,0.2)';
        minimizeButton.style.color = 'white';
        minimizeButton.style.borderRadius = '0.25rem';
        minimizeButton.style.cursor = 'pointer';
        minimizeButton.style.fontSize = '1.25rem';
        minimizeButton.style.lineHeight = '1';
        minimizeButton.style.display = 'flex';
        minimizeButton.style.alignItems = 'center';
        minimizeButton.style.justifyContent = 'center';
        minimizeButton.style.transition = 'all 0.2s';

        minimizeButton.onmouseover = () => {
            minimizeButton.style.background = 'rgba(255,255,255,0.3)';
        };

        minimizeButton.onmouseout = () => {
            minimizeButton.style.background = 'rgba(255,255,255,0.2)';
        };

        minimizeButton.onclick = () => {
            this.isMinimized = !this.isMinimized;
            
            if (this.isMinimized) {
                minimizeButton.innerHTML = '+';
                cacheUI.style.height = 'auto';
                cacheUI.style.minHeight = 'auto';
                cacheList.style.display = 'none';
                cacheList.style.opacity = '0';
                title.style.marginBottom = '0.5rem';
                cacheUI.style.padding = '0.5rem';
            } else {
                minimizeButton.innerHTML = '−';
                cacheUI.style.height = '';
                cacheUI.style.minHeight = '10rem';
                cacheList.style.display = '';
                cacheList.style.opacity = '1';
                title.style.marginBottom = '0.75rem';
                cacheUI.style.padding = '1rem';
            }
            
            // Save state to localStorage
            this.saveCheckboxStates();
        };

        cacheUI.appendChild(minimizeButton);

        // Add cache types
        this.cacheTypes.forEach(type => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.padding = '0.5rem';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '0.375rem';
            item.style.marginBottom = '0.5rem';
            item.style.transition = 'background-color 0.2s';

            item.onmouseover = () => item.style.backgroundColor = 'rgba(255,255,255,0.1)';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = type.id;
            checkbox.style.marginRight = '0.75rem';
            checkbox.style.width = '1rem';
            checkbox.style.height = '1rem';
            checkbox.checked = type.defaultChecked;

            checkbox.onchange = () => {
                this.saveCheckboxStates();
            };

            const label = document.createElement('label');
            label.htmlFor = type.id;
            label.textContent = type.name;
            label.style.flex = '1';
            label.style.cursor = 'pointer';

            const info = document.createElement('span');
            info.id = `${type.id}-info`;
            info.style.marginLeft = '0.75rem';
            info.style.color = '#aaa';
            info.style.cursor = 'pointer';
            info.style.padding = '0.25rem 0.5rem';
            info.style.borderRadius = '0.25rem';
            info.style.transition = 'all 0.2s';

            if (['webStorage', 'cookies', 'jsCache'].includes(type.id)) {
                info.style.backgroundColor = 'rgba(255,255,255,0.2)';
                info.style.color = '#fff';
                info.style.fontWeight = '500';
                info.style.display = 'inline-flex';
                info.style.alignItems = 'center';
                info.style.gap = '0.5rem';
                // Add icon
                const icon = document.createElement('span');
                icon.textContent = '🔍';
                icon.style.fontSize = '0.75rem';
                info.prepend(icon);
                info.onmouseover = () => {
                    info.style.backgroundColor = 'rgba(255,255,255,0.3)';
                };
                info.onmouseout = () => {
                    info.style.backgroundColor = 'rgba(255,255,255,0.2)';
                };
            } else {
                info.onmouseover = () => {
                    info.style.backgroundColor = 'rgba(255,255,255,0.1)';
                };
                info.onmouseout = () => {
                    info.style.backgroundColor = 'transparent';
                };
            }

            info.onclick = async () => {
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
                            info.style.color = '#4CAF50';
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
            };

            item.appendChild(checkbox);
            item.appendChild(label);
            item.appendChild(info);
            cacheList.appendChild(item);
        });

        cacheUI.appendChild(cacheList);

        // Create clear button
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear & Reload';
        clearButton.style.padding = '0.75rem 1rem';
        clearButton.style.backgroundColor = '#dc3545';
        clearButton.style.color = 'white';
        clearButton.style.border = 'none';
        clearButton.style.borderRadius = '0.375rem';
        clearButton.style.cursor = 'pointer';
        clearButton.style.fontSize = '1rem';
        clearButton.style.width = '100%';
        clearButton.style.marginTop = '0.75rem';

        clearButton.onclick = async () => {
            const selectedTypes = this.cacheTypes.filter(type => 
                document.getElementById(type.id).checked
            );

            if (selectedTypes.length === 0) {
                return;
            }

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

        cacheUI.appendChild(clearButton);

        // Apply initial minimized state if needed
        if (this.isMinimized) {
            cacheUI.style.height = 'auto';
            cacheUI.style.minHeight = 'auto';
            cacheList.style.display = 'none';
            cacheList.style.opacity = '0';
            title.style.marginBottom = '0.5rem';
            cacheUI.style.padding = '0.5rem';
        }

        uiContainer.appendChild(cacheUI);

        // Force File System checkbox to be unchecked after UI creation
        setTimeout(() => {
            const fileSystemCheckbox = document.getElementById('fileSystem');
            if (fileSystemCheckbox) fileSystemCheckbox.checked = false;
        }, 0);
    }

    showWebStoragePopup() {
        // Create popup container
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.backgroundColor = 'rgba(0,0,0,0.9)';
        popup.style.padding = '1rem';
        popup.style.borderRadius = '0.5rem';
        popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        popup.style.zIndex = '2000';
        popup.style.maxWidth = '80vw';
        popup.style.maxHeight = '80vh';
        popup.style.overflow = 'auto';
        popup.style.fontFamily = 'monospace';
        popup.style.fontSize = '1rem';
        popup.style.color = 'white';

        // Create title
        const title = document.createElement('div');
        title.textContent = 'Web Storage Contents';
        title.style.fontSize = '1rem';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '1rem';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.style.paddingBottom = '0.5rem';
        popup.appendChild(title);

        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '1rem';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Storage', 'Key', 'Value'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.textAlign = 'left';
            th.style.padding = '0.5rem';
            th.style.borderBottom = '2px solid rgba(255,255,255,0.2)';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');

        // Add localStorage items
        Object.entries(localStorage).forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            const storageCell = document.createElement('td');
            storageCell.textContent = 'localStorage';
            storageCell.style.padding = '0.5rem';
            storageCell.style.color = '#4CAF50';

            const keyCell = document.createElement('td');
            keyCell.textContent = key;
            keyCell.style.padding = '0.5rem';
            keyCell.style.fontFamily = 'monospace';

            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            valueCell.style.padding = '0.5rem';
            valueCell.style.fontFamily = 'monospace';
            valueCell.style.maxWidth = '300px';
            valueCell.style.wordBreak = 'break-all';
            valueCell.style.whiteSpace = 'pre-wrap';
            valueCell.style.overflow = 'hidden';

            row.appendChild(storageCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });

        // Add sessionStorage items
        Object.entries(sessionStorage).forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            const storageCell = document.createElement('td');
            storageCell.textContent = 'sessionStorage';
            storageCell.style.padding = '0.5rem';
            storageCell.style.color = '#2196F3';

            const keyCell = document.createElement('td');
            keyCell.textContent = key;
            keyCell.style.padding = '0.5rem';
            keyCell.style.fontFamily = 'monospace';

            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            valueCell.style.padding = '0.5rem';
            valueCell.style.fontFamily = 'monospace';
            valueCell.style.maxWidth = '300px';
            valueCell.style.wordBreak = 'break-all';
            valueCell.style.whiteSpace = 'pre-wrap';
            valueCell.style.overflow = 'hidden';

            row.appendChild(storageCell);
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        popup.appendChild(table);

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '0.5rem 1rem';
        closeButton.style.backgroundColor = '#dc3545';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '0.25rem';
        closeButton.style.cursor = 'pointer';
        closeButton.style.width = '100%';
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1999';
        overlay.onclick = () => {
            overlay.remove();
            popup.remove();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
    }

    showCookiesPopup() {
        // Create popup container
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.backgroundColor = 'rgba(0,0,0,0.9)';
        popup.style.padding = '1rem';
        popup.style.borderRadius = '0.5rem';
        popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        popup.style.zIndex = '2000';
        popup.style.maxWidth = '80vw';
        popup.style.maxHeight = '80vh';
        popup.style.overflow = 'auto';
        popup.style.fontFamily = 'monospace';
        popup.style.fontSize = '1rem';
        popup.style.color = 'white';

        // Create title
        const title = document.createElement('div');
        title.textContent = 'Cookies Contents';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '1rem';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.style.paddingBottom = '0.5rem';
        popup.appendChild(title);

        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '1rem';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Name', 'Value', 'Domain', 'Path', 'Expires', 'Secure', 'HttpOnly'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.textAlign = 'left';
            th.style.padding = '0.5rem';
            th.style.borderBottom = '2px solid rgba(255,255,255,0.2)';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');

        // Parse cookies
        const cookies = document.cookie.split(';').map(cookie => {
            const [name, ...rest] = cookie.trim().split('=');
            const value = rest.join('='); // Handle values that might contain '='
            return { name, value };
        });

        // Add cookie items
        cookies.forEach(cookie => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            // Name
            const nameCell = document.createElement('td');
            nameCell.textContent = cookie.name;
            nameCell.style.padding = '0.5rem';
            nameCell.style.fontFamily = 'monospace';
            nameCell.style.color = '#4CAF50';

            // Value
            const valueCell = document.createElement('td');
            valueCell.textContent = cookie.value;
            valueCell.style.padding = '0.5rem';
            valueCell.style.fontFamily = 'monospace';
            valueCell.style.maxWidth = '200px';
            valueCell.style.wordBreak = 'break-all';
            valueCell.style.whiteSpace = 'pre-wrap';
            valueCell.style.overflow = 'hidden';

            // Domain
            const domainCell = document.createElement('td');
            domainCell.textContent = window.location.hostname;
            domainCell.style.padding = '0.5rem';
            domainCell.style.fontFamily = 'monospace';

            // Path
            const pathCell = document.createElement('td');
            pathCell.textContent = '/';
            pathCell.style.padding = '0.5rem';
            pathCell.style.fontFamily = 'monospace';

            // Expires
            const expiresCell = document.createElement('td');
            expiresCell.textContent = 'Session';
            expiresCell.style.padding = '0.5rem';
            expiresCell.style.fontFamily = 'monospace';

            // Secure
            const secureCell = document.createElement('td');
            secureCell.textContent = window.location.protocol === 'https:' ? 'Yes' : 'No';
            secureCell.style.padding = '0.5rem';
            secureCell.style.fontFamily = 'monospace';

            // HttpOnly
            const httpOnlyCell = document.createElement('td');
            httpOnlyCell.textContent = 'Unknown';
            httpOnlyCell.style.padding = '0.5rem';
            httpOnlyCell.style.fontFamily = 'monospace';

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

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '0.5rem 1rem';
        closeButton.style.backgroundColor = '#dc3545';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '0.25rem';
        closeButton.style.cursor = 'pointer';
        closeButton.style.width = '100%';
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1999';
        overlay.onclick = () => {
            overlay.remove();
            popup.remove();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
    }

    showJSCachePopup() {
        // Create popup container
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.backgroundColor = 'rgba(0,0,0,0.9)';
        popup.style.padding = '0.75rem';
        popup.style.borderRadius = '0.5rem';
        popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        popup.style.zIndex = '2000';
        popup.style.width = '90vw';
        popup.style.maxWidth = '600px';
        popup.style.fontFamily = 'monospace';
        popup.style.fontSize = '1rem';
        popup.style.color = 'white';

        // Create title
        const title = document.createElement('div');
        title.textContent = 'JavaScript Files Cache';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '0.5rem';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.style.paddingBottom = '0.25rem';
        popup.appendChild(title);

        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '0.5rem';
        table.style.tableLayout = 'fixed';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        [
            { text: 'File', width: '30%' },
            { text: 'Status', width: '15%' },
            { text: 'Size', width: '15%' },
            { text: 'Modified', width: '40%' }
        ].forEach(({ text, width }) => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.textAlign = 'left';
            th.style.padding = '0.25rem';
            th.style.borderBottom = '2px solid rgba(255,255,255,0.2)';
            th.style.width = width;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');

        // Get all scripts
        const scripts = Array.from(document.scripts);
        scripts.forEach(script => {
            if (script.src) {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

                // File name
                const fileCell = document.createElement('td');
                fileCell.textContent = script.src.split('/').pop();
                fileCell.style.padding = '0.25rem';
                fileCell.style.fontFamily = 'monospace';
                fileCell.style.color = '#4CAF50';
                fileCell.style.overflow = 'hidden';
                fileCell.style.textOverflow = 'ellipsis';
                fileCell.style.whiteSpace = 'nowrap';

                // Status
                const statusCell = document.createElement('td');
                statusCell.textContent = 'Cached';
                statusCell.style.padding = '0.25rem';
                statusCell.style.fontFamily = 'monospace';

                // Size
                const sizeCell = document.createElement('td');
                sizeCell.textContent = 'Unknown';
                sizeCell.style.padding = '0.25rem';
                sizeCell.style.fontFamily = 'monospace';

                // Last Modified
                const modifiedCell = document.createElement('td');
                modifiedCell.textContent = 'Unknown';
                modifiedCell.style.padding = '0.25rem';
                modifiedCell.style.fontFamily = 'monospace';
                modifiedCell.style.overflow = 'hidden';
                modifiedCell.style.textOverflow = 'ellipsis';
                modifiedCell.style.whiteSpace = 'nowrap';

                // Try to get file info
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

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '0.25rem 0.5rem';
        closeButton.style.backgroundColor = '#dc3545';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '0.25rem';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontWeight = 'bold';
        closeButton.style.width = '100%';
        closeButton.onclick = () => popup.remove();
        popup.appendChild(closeButton);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1999';
        overlay.onclick = () => {
            overlay.remove();
            popup.remove();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
    }

    // Clear methods for each type
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

    async clearWebGL() {
        if (window._gl) {
            const gl = window._gl;
            gl.getExtension('WEBGL_lose_context')?.loseContext();
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
            // Request permission to clear file system
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

    async clearSharedWorkers() {
        // Shared workers can't be cleared programmatically
        console.warn('Shared workers can only be cleared by closing all tabs');
    }

    async clearWebRTC() {
        // WebRTC connections are automatically closed when the page is unloaded
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
                // Can't revoke permissions programmatically
                console.warn('Notification permissions can only be revoked in browser settings');
            }
        }
    }

    async clearGeolocation() {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
                // Can't revoke permissions programmatically
                console.warn('Geolocation permissions can only be revoked in browser settings');
            }
        }
    }

    async clearMediaDevices() {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'camera' });
            if (result.state === 'granted') {
                // Can't revoke permissions programmatically
                console.warn('Media device permissions can only be revoked in browser settings');
            }
        }
    }

    async clearPermissions() {
        if ('permissions' in navigator) {
            // Can't revoke permissions programmatically
            console.warn('Permissions can only be revoked in browser settings');
        }
    }

    async clearJSCache() {
        // Clear browser cache for JavaScript files
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Force reload all scripts
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

// Wrap observer in IIFE to avoid variable redeclaration
(function() {
    const observer = new MutationObserver((mutations) => {
        if (window.YAGA) {
            observer.disconnect();
            console.log('🧹 Enable test-clear-cache.js');
            const cacheManager = new CacheManager();
            cacheManager.init();
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
})(); 

const isDesktop = /Win|Mac|Linux|X11|CrOS/.test(navigator.platform);
document.documentElement.style.setProperty('font-size', isDesktop ? '0.6rem' : '1rem', 'important');
