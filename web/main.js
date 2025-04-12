// Class for managing canvas
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
        // Set canvas dimensions
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log("Canvas dimensions set to:", this.canvas.width, "x", this.canvas.height);
        
        // Clear canvas and fill with black
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        console.log("Canvas cleared and filled with black");
    }
    
    getCanvasId() {
        return this.canvas.id;
    }
}

// Class for managing SLAM module
class SlamModule {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.instance = null;
    }
    
    async initialize() {
        console.log("Initializing SLAM module...");
        
        try {
            // Load script yadviga-slam.js
            await this.loadScript('./yadviga-slam.js');
            
            // Create module instance
            this.instance = await createModule();
            console.log("Module instance created:", this.instance);
            
            // Initialize SLAM
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

// Function to start the application
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

// Wait for DOM to load before starting application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
} 