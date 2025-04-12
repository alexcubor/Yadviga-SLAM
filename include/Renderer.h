/**
 * @file Renderer.h
 * @brief Header file for the Renderer module
 * 
 * This file declares the functions for rendering video and overlays on a canvas.
 * The renderer is responsible for drawing the video stream from the camera and
 * adding visual overlays like the red rectangle and "SLAM Active" text.
 */

#ifndef RENDERER_H
#define RENDERER_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the renderer with the given canvas ID
 * 
 * This function sets up the renderer to draw video from the camera onto the specified canvas.
 * It also adds visual overlays like a red rectangle and "SLAM Active" text.
 * 
 * @param canvasId The ID of the canvas element to render on
 */
void initializeRenderer(const char* canvasId);

/**
 * @brief Stop the renderer and clean up resources
 * 
 * This function stops the rendering process and cleans up any resources used by the renderer.
 * 
 * @param canvasId The ID of the canvas element that was being rendered on
 */
void stopRenderer(const char* canvasId);

#ifdef __cplusplus
}
#endif

#endif // RENDERER_H 