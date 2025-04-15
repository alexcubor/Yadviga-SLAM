#ifndef INITIALIZE_H
#define INITIALIZE_H

#ifdef __cplusplus
extern "C" {
#endif

void initializeSLAM(const char* canvasId);
void stopSLAM(const char* canvasId);

#ifdef __cplusplus
}
#endif

#endif // INITIALIZE_H