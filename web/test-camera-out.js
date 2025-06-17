(function() {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    const MAX_BLUR = 200; // Maximum blur in pixels
    const MIN_BLUR = 0;  // Minimum blur in pixels
    const MAX_DISTANCE = 10; // Distance at which maximum blur is reached
    const MAX_OFFSET = 200; // Offset at which maximum blur is reached

    // Save initial camera position on first drag
    let dragStartCameraX = 0;
    let dragStartCameraY = 0;
    let dragStartCameraZ = 0;
    let isFirstDrag = true;

    function calculateBlur(distance) {
        // Use quadratic dependency for smoother effect
        const normalizedDistance = Math.min(distance / MAX_DISTANCE, 1);
        return MIN_BLUR + (normalizedDistance * normalizedDistance) * (MAX_BLUR - MIN_BLUR);
    }

    function updateBlur(canvas, currentX, currentY) {
        // Get camera
        const camera = YAGA.camera;
        if (!camera) {
            console.log('🎥 Camera not available in updateBlur');
            return;
        }

        if (!camera.position || !camera.position.x) {
            canvas.style.transform = 'translate(0px, 0px)';
            canvas.style.filter = 'blur(0px)';
            canvas.style.webkitFilter = 'blur(0px)';
            canvas.style.backdropFilter = 'blur(0px)';
            return;
        }

        const cameraDistance = Math.sqrt(
            camera.position.x * camera.position.x + 
            (camera.position.y - 0.5) * (camera.position.y - 0.5) + 
            camera.position.z * camera.position.z
        );
        const cameraPhi = Math.acos((camera.position.y - 0.5) / cameraDistance);
        const cameraTheta = Math.atan2(camera.position.z, camera.position.x);

        // Initial camera values (in radians)
        const INITIAL_THETA = Math.PI / 2; // 90 degrees
        const INITIAL_PHI = 75.96 * Math.PI / 180; // 75.96 degrees

        // Calculate canvas offset relative to initial position
        const offsetX = -(cameraTheta - INITIAL_THETA) * 100; // Invert X and offset by 100px per radian
        const offsetY = (cameraPhi - INITIAL_PHI) * 100; // Invert Y and offset by 100px per radian

        // Calculate total offset for blur
        const totalOffset = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        
        // Calculate blur based on offset
        const blurAmount = Math.min((totalOffset / MAX_OFFSET) * MAX_BLUR, MAX_BLUR);

        // Apply offset and blur without animation
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        canvas.style.filter = `blur(${blurAmount}px)`;
        canvas.style.webkitFilter = `blur(${blurAmount}px)`;
        canvas.style.backdropFilter = `blur(${blurAmount}px)`;
    }

    function setupInteractiveBlur() {
        const canvas = YAGA.canvas;
        if (!canvas) {
            console.log('🎥 Canvas not available');
            return;
        }

        // Disable all animations and set initial position
        canvas.style.transition = 'none';
        canvas.style.transform = 'translate(0px, 0px)';

        // Start position update in animation loop
        function animate() {
            updateBlur(canvas, 0, 0);
            requestAnimationFrame(animate);
        }
        animate();

        function handleStart(e) {
            const target = e.target;
            if (target.closest('.ui-element, button, input, select, textarea')) return;
            
            isDragging = true;
            startX = e.clientX || e.touches[0].clientX;
            startY = e.clientY || e.touches[0].clientY;
            
            updateBlur(canvas, startX, startY);

            e.preventDefault();
            e.stopPropagation();
        }

        function handleMove(e) {
            if (!isDragging) return;
            
            const currentX = e.clientX || e.touches[0].clientX;
            const currentY = e.clientY || e.touches[0].clientY;
            updateBlur(canvas, currentX, currentY);

            e.preventDefault();
            e.stopPropagation();
        }

        function handleEnd(e) {
            if (!isDragging) return;
            
            isDragging = false;
            
            // Update position for current camera position
            const currentX = e.clientX || e.touches[0].clientX;
            const currentY = e.clientY || e.touches[0].clientY;
            updateBlur(canvas, currentX, currentY);

            e.preventDefault();
            e.stopPropagation();
        }

        // Find all canvases and their parents
        const allCanvases = document.querySelectorAll('canvas');
        const parents = new Set();
        allCanvases.forEach(c => {
            if (c.parentElement) parents.add(c.parentElement);
        });

        // Add event listeners to all canvases
        allCanvases.forEach(c => {
            c.addEventListener('mousedown', handleStart);
            c.addEventListener('touchstart', handleStart);
        });

        // Add event listeners to parents
        parents.forEach(p => {
            p.addEventListener('mousedown', handleStart);
            p.addEventListener('touchstart', handleStart);
        });

        // Global events for move and end
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('mouseleave', handleEnd);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);
    }

    // Wait for YAGA initialization through MutationObserver
    const blurObserver = new MutationObserver((mutations) => {
        if (window.YAGA && window.YAGA.canvas) {
            blurObserver.disconnect();
            setupInteractiveBlur();
        }
    });

    blurObserver.observe(document, {
        childList: true,
        subtree: true
    });
})(); 