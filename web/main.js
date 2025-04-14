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
    
    async setupSlam() {
        if (!this.instance || typeof this.instance.ccall !== 'function') {
            throw new Error("Module not properly initialized");
        }
        
        const canvasId = this.canvasManager.getCanvasId();
        console.log("Calling initializeSLAM with canvas ID:", canvasId);
        
        // Initialize SLAM - this will set up the canvas and get camera access
        this.instance.ccall('initializeSLAM', 'void', ['string'], [canvasId]);
        
        // Wait for the camera to be ready
        await new Promise(resolve => {
            window.addEventListener('slamCameraReady', resolve, { once: true });
            // Also set a timeout in case the event doesn't fire
            setTimeout(resolve, 2000);
        });
    }
}

// Function to start the application
async function startApplication() {
    try {
        const canvasManager = new CanvasManager('xr-canvas');
        const slamModule = new SlamModule(canvasManager);
        await slamModule.initialize();
        console.log("Application started successfully");
        
        // Set up a global reference to the SLAM module for debugging
        window.slamModule = slamModule;
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