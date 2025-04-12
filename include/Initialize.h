/**
 * @file Initialize.h
 * @brief Header file for the SLAM initialization module
 * 
 * This file declares the functions for initializing the SLAM system.
 * The initialization module is responsible for setting up the canvas and
 * getting camera access for the SLAM system.
 */

#ifndef INITIALIZE_H
#define INITIALIZE_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the SLAM system with the given canvas ID
 * 
 * This function sets up the SLAM system with the specified canvas.
 * It gets camera access and prepares the system for tracking and rendering.
 * 
 * @param canvasId The ID of the canvas element to use for SLAM
 */
void initializeSLAM(const char* canvasId);

/**
 * @brief Stop the SLAM system and clean up resources
 * 
 * This function stops the SLAM system and releases any resources it was using,
 * such as camera access.
 * 
 * @param canvasId The ID of the canvas element that was being used
 */
void stopSLAM(const char* canvasId);

#ifdef __cplusplus
}
#endif

#endif // INITIALIZE_H