#ifndef TRACKING_H
#define TRACKING_H

#include <emscripten.h>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <vector>

// Function declarations
void initializeTracking();
void getVideoFrame(const char* canvasId);
void processFrame(const unsigned char* imageData, int width, int height);
void getCameraPose(double* rotation, double* translation);

// SLAM tracking class
class SLAMTracker {
public:
    SLAMTracker();
    ~SLAMTracker();
    
    // Initialize the tracker
    void initialize();
    
    // Process a frame
    void processFrame(const cv::Mat& frame);
    
    // Get the current camera pose
    void getPose(cv::Mat& rotation, cv::Mat& translation);
    
private:
    // Previous frame
    cv::Mat prevFrame;
    
    // Feature points
    std::vector<cv::Point2f> prevPoints;
    std::vector<cv::Point2f> currentPoints;
    
    // Feature detector
    cv::Ptr<cv::Feature2D> featureDetector;
    
    // Camera matrix (intrinsics)
    cv::Mat cameraMatrix;
    
    // Distortion coefficients
    cv::Mat distCoeffs;
    
    // Current camera pose
    cv::Mat R; // Rotation matrix
    cv::Mat t; // Translation vector
    
    // Flag for first frame
    bool isFirstFrame;
    
    // Extract features from frame
    void extractFeatures(const cv::Mat& frame, std::vector<cv::Point2f>& points);
    
    // Match features between frames
    void matchFeatures(const cv::Mat& frame, std::vector<cv::Point2f>& prevPoints, 
                       std::vector<cv::Point2f>& currentPoints);
    
    // Estimate camera pose
    void estimatePose(const std::vector<cv::Point2f>& prevPoints, 
                      const std::vector<cv::Point2f>& currentPoints);
};

#endif // TRACKING_H 