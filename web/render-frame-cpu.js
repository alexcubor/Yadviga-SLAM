// Create video element
if (!window.YAGA) {
    window.YAGA = { 
        video: null,
        init() {
            // Инициализация YAGA
            console.log('YAGA initialized');
        }
    };
}

if (!YAGA.video) {
    YAGA.video = document.createElement('video');
    YAGA.video.autoplay = true;
    YAGA.video.playsInline = true;
}

// Create canvas for CPU rendering
const canvas = document.createElement('canvas');
canvas.id = 'xr-canvas';  // Добавляем id для совместимости
const ctx = canvas.getContext('2d');

// Style canvas to fill screen
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.objectFit = 'cover';

// Add canvas to page
document.body.appendChild(canvas);

// Request camera access
navigator.mediaDevices.getUserMedia({
    video: {
        deviceId: localStorage.getItem('slam_camera_id') ? 
            { exact: localStorage.getItem('slam_camera_id') } : 
            undefined,
        facingMode: { ideal: "environment" },  // Use back camera by default
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    }
}).then(stream => {
    YAGA.video.srcObject = stream;
    YAGA.video.play();
    YAGA.init();  // Вызываем init после инициализации видео

    let logsPrinted = false;  // Флаг для отслеживания вывода логов

    // Render loop
    function render() {
        // Update canvas size if window is resized
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth * window.devicePixelRatio;
            canvas.height = displayHeight * window.devicePixelRatio;
        }

        // Получаем текущий поток из видео элемента
        const currentStream = YAGA.video.srcObject;
        if (currentStream) {
            const videoTrack = currentStream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                // console.log('📹 Current camera settings:', settings);
                
                // Определяем, является ли камера задней по facingMode
                const isBackCamera = settings.facingMode === 'environment';
                const shouldMirror = !isBackCamera;
                // console.log('📹 Should mirror:', shouldMirror);

                // Calculate aspect ratios
                const videoAspect = YAGA.video.videoWidth / YAGA.video.videoHeight;
                const canvasAspect = canvas.width / canvas.height;

                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

                // Always fit to height
                drawHeight = canvas.height;
                drawWidth = drawHeight * videoAspect;
                offsetX = (canvas.width - drawWidth) / 2;

                // Clear canvas
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Save context state
                ctx.save();

                if (shouldMirror) {
                    // Mirror for non-back cameras
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }

                // Draw video frame to canvas with proper scaling
                ctx.drawImage(YAGA.video, offsetX, offsetY, drawWidth, drawHeight);

                // Restore context state
                ctx.restore();
            }
        }
        
        // Request next frame
        requestAnimationFrame(render);
    }
    
    // Start render loop
    render();
    
}).catch(err => {
    console.error("Error accessing camera:", err);
});