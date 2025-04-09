// Класс для управления canvas
class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas '${canvasId}' not found!`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Failed to get canvas context!');
        }
        
        this.initializeCanvas();
    }
    
    initializeCanvas() {
        // Устанавливаем размеры canvas
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log("Canvas dimensions set to:", this.canvas.width, "x", this.canvas.height);
        
        // Очищаем canvas и рисуем что-то для проверки
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        console.log("Canvas cleared and filled with black");
    }
    
    getCanvasId() {
        return this.canvas.id;
    }
}

// Класс для управления SLAM модулем
class SlamModule {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.instance = null;
    }
    
    async initialize() {
        console.log("Initializing SLAM module...");
        
        try {
            // Загружаем скрипт slam_init.js
            await this.loadScript('./slam_init.js');
            
            // Создаем экземпляр модуля
            this.instance = await createModule();
            console.log("Module instance created:", this.instance);
            
            // Инициализируем SLAM
            await this.setupSlam();
            
            return this.instance;
        } catch (error) {
            console.error('Failed to initialize SLAM module:', error);
            throw error;
        }
    }
    
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async setupSlam() {
        if (!this.instance || typeof this.instance.ccall !== 'function') {
            throw new Error("Module not properly initialized");
        }
        
        console.log("Calling initializeSLAM with canvas ID:", this.canvasManager.getCanvasId());
        this.instance.ccall('initializeSLAM', 'void', ['string'], [this.canvasManager.getCanvasId()]);
    }
}

// Функция для запуска приложения
async function startApplication() {
    try {
        const canvasManager = new CanvasManager('xr-canvas');
        const slamModule = new SlamModule(canvasManager);
        await slamModule.initialize();
        console.log("Application started successfully");
    } catch (error) {
        console.error("Application failed to start:", error);
    }
}

// Ждем загрузки DOM перед инициализацией
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
} 