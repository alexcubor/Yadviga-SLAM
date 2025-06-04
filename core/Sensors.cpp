#include <mutex>
#include <cmath>
#include <array>
#include <emscripten.h>

// Simple quaternion struct for orientation
struct Quaternion {
    float w, x, y, z;
    Quaternion() : w(1), x(0), y(0), z(0) {}
    Quaternion(float w_, float x_, float y_, float z_) : w(w_), x(x_), y(y_), z(z_) {}
};

class IMUState {
public:
    IMUState() : timestamp(0) {
        orientation = Quaternion();
        position = {0, 0, 0};
        velocity = {0, 0, 0};
        rotationRate = {0, 0, 0};
    }

    // Update IMU state with new sensor data
    void update(float wx, float wy, float wz, float ax, float ay, float az, float newTimestamp, float rx = 0, float ry = 0, float rz = 0) {
        std::lock_guard<std::mutex> lock(mutex);
        
        // Check validity of input data
        if (std::isnan(wx) || std::isnan(wy) || std::isnan(wz) || 
            std::isnan(ax) || std::isnan(ay) || std::isnan(az) || 
            std::isnan(newTimestamp)) {
            return;
        }
        
        float dt = (timestamp > 0) ? (newTimestamp - timestamp) : 0;
        timestamp = newTimestamp;

        // Update rotation rate
        rotationRate[0] = rx;
        rotationRate[1] = ry;
        rotationRate[2] = rz;

        // Integrate gyroscope to update orientation
        integrateGyro(wx, wy, wz, dt);
        // Integrate acceleration to update velocity and position
        integrateAccel(ax, ay, az, dt);
        
        // Check validity of results for orientation
        if (std::isnan(orientation.w) || std::isnan(orientation.x) || 
            std::isnan(orientation.y) || std::isnan(orientation.z)) {
            orientation = Quaternion();
        }
        
        // Check validity of results for position and velocity
        for (int i = 0; i < 3; ++i) {
            if (std::isnan(position[i]) || std::isnan(velocity[i])) {
                position[i] = 0;
                velocity[i] = 0;
            }
        }
    }
    
    Quaternion getOrientation() {
        std::lock_guard<std::mutex> lock(mutex);
        return orientation;
    }

    std::array<float, 3> getPosition() {
        std::lock_guard<std::mutex> lock(mutex);
        return position;
    }

    std::array<float, 3> getRotationRate() {
        std::lock_guard<std::mutex> lock(mutex);
        return rotationRate;
    }

private:
    Quaternion orientation;
    std::array<float, 3> position;
    std::array<float, 3> velocity;
    std::array<float, 3> rotationRate;
    float timestamp;
    std::mutex mutex;

    // Stub: integrate gyroscope data (replace with real filter)
    void integrateGyro(float wx, float wy, float wz, float dt) {
        // Very basic: just accumulate yaw (wz) for demonstration
        if (dt > 0) {
            float angle = wz * dt;
            float halfAngle = angle * 0.5f;
            float sinHalf = std::sin(halfAngle);
            float cosHalf = std::cos(halfAngle);
            // Yaw-only update (for demo)
            orientation = Quaternion(cosHalf, 0, 0, sinHalf);
        }
    }

    // Stub: integrate acceleration (replace with real filter)
    void integrateAccel(float ax, float ay, float az, float dt) {
        if (dt > 0) {
            // Simple integration (no gravity compensation)
            for (int i = 0; i < 3; ++i) {
                velocity[i] += (i == 0 ? ax : (i == 1 ? ay : az)) * dt;
                position[i] += velocity[i] * dt;
            }
        }
    }
};

// Global IMU state instance
IMUState g_imuState;
bool g_imuAvailable = false;  // Global status of IMU availability

extern "C" {
    EMSCRIPTEN_KEEPALIVE void initIMU() {
        // Always consider sensors available
        g_imuAvailable = true;
        
        // Add event handlers for sensors
        EM_ASM_({
            let motionListener = null;
            let orientationListener = null;
            let hasRequestedPermissions = false;
            let isDesktop = /Windows|Macintosh|Linux/i.test(navigator.userAgent);

            async function requestSensorPermissions() {
                if (hasRequestedPermissions) return;
                
                // On desktop, add handlers immediately
                if (isDesktop) {
                    console.log('📱 Sensors ✅ Emulated');
                    hasRequestedPermissions = true;
                    setupSensorListeners();
                    return;
                }
                
                try {
                    // Check for permission request functions
                    const hasMotionPermission = typeof DeviceMotionEvent !== 'undefined' && 
                                             typeof DeviceMotionEvent.requestPermission === 'function';
                    const hasOrientationPermission = typeof DeviceOrientationEvent !== 'undefined' && 
                                                   typeof DeviceOrientationEvent.requestPermission === 'function';

                    let permissionsGranted = false;

                    // Request permission for motion
                    if (hasMotionPermission) {
                        try {
                            const motionPermission = await DeviceMotionEvent.requestPermission();
                            if (motionPermission === 'granted') {
                                permissionsGranted = true;
                            }
                        } catch (motionError) {
                            console.warn('Requesting motion permission');
                        }
                    }
                    
                    // Request permission for orientation
                    if (hasOrientationPermission) {
                        try {
                            const orientationPermission = await DeviceOrientationEvent.requestPermission();
                            if (orientationPermission === 'granted') {
                                permissionsGranted = true;
                            }
                        } catch (orientationError) {
                            console.warn('Requesting orientation permission');
                        }
                    }

                    if (permissionsGranted) {
                        console.log('📱 Sensors ✅ IMU');
                        hasRequestedPermissions = true;
                        setupSensorListeners();
                    }
                } catch (error) {
                    console.error('Permission request error:', error);
                    hasRequestedPermissions = false;
                }
            }
            
            // Get motion data from device
            function setupSensorListeners() {
                if (!motionListener) {
                    motionListener = function(event) {
                        if (event.acceleration && event.rotationRate) {
                            const toRad = Math.PI / 180;
                            // Check if we have actual data
                            if (event.acceleration.x !== null || event.acceleration.y !== null || event.acceleration.z !== null ||
                                event.rotationRate.alpha !== null || event.rotationRate.beta !== null || event.rotationRate.gamma !== null) {
                                Module._updateIMU(
                                    0, 0, 0,  // orientation data will come from deviceorientation
                                    event.acceleration.x || 0,
                                    event.acceleration.y || 0,
                                    event.acceleration.z || 0,
                                    event.timeStamp / 1000.0,
                                    event.rotationRate.alpha * toRad || 0,
                                    event.rotationRate.beta * toRad || 0,
                                    event.rotationRate.gamma * toRad || 0
                                );
                            }
                        }
                    };
                    window.addEventListener('devicemotion', motionListener);
                }

                // Get orientation data from device
                if (!orientationListener) {
                    orientationListener = function(event) {
                        if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
                            const toRad = Math.PI / 180;
                            Module._updateIMU(
                                event.alpha * toRad || 0,
                                event.beta * toRad || 0,
                                event.gamma * toRad || 0,
                                0, 0, 0,  // acceleration data will come from devicemotion
                                event.timeStamp / 1000.0,
                                0, 0, 0   // rotation rate data will come from devicemotion
                            );
                        }
                    };
                    window.addEventListener('deviceorientation', orientationListener);
                }
            }

            // On desktop, start sensors immediately
            if (isDesktop) {
                requestSensorPermissions();
            } else {
                // Try adding handlers immediately
                setupSensorListeners();
                
                // Check if data is coming
                let dataReceived = false;
                let checkTimeout = setTimeout(() => {
                    if (!dataReceived) {
                        // If data is not coming, add handler for permission request
                        function handleFirstInteraction(event) {
                            // Check if click/touch
                            const target = event.target;
                            const isCanvas = target.tagName === 'CANVAS' || target.closest('canvas') !== null;

                            if (!isCanvas) {
                                return; // Skip non-canvas elements
                            }

                            // Prevent event bubbling only for canvas
                            event.stopPropagation();
                            event.preventDefault();
                            
                            // Request permissions
                            requestSensorPermissions();
                            
                            // Remove handlers after first interaction
                            document.removeEventListener('click', handleFirstInteraction);
                            document.removeEventListener('touchstart', handleFirstInteraction);
                        }

                        // Add handlers for first click or touch
                        document.addEventListener('click', handleFirstInteraction, { capture: true });
                        document.addEventListener('touchstart', handleFirstInteraction, { capture: true });
                    }
                }, 1000); // Wait 1 second

                // If data received, cancel timeout
                const checkData = function(event) {
                    if (event.acceleration || (event.alpha !== null && event.beta !== null && event.gamma !== null)) {
                        dataReceived = true;
                        clearTimeout(checkTimeout);
                        window.removeEventListener('devicemotion', checkData);
                        window.removeEventListener('deviceorientation', checkData);
                    }
                };
                window.addEventListener('devicemotion', checkData);
                window.addEventListener('deviceorientation', checkData);
            }
        });
    }

    EMSCRIPTEN_KEEPALIVE void updateIMU(float wx, float wy, float wz, float ax, float ay, float az, float timestamp, float rx = 0, float ry = 0, float rz = 0) {
        g_imuState.update(wx, wy, wz, ax, ay, az, timestamp, rx, ry, rz);
    }
} 