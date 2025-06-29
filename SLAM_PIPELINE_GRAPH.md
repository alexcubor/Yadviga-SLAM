# SLAM Pipeline Graph

```mermaid
graph TD
    %% Input
    A[📷 Кадр N] --> B[📷 Кадр N+1]
    
    %% Feature Detection & Tracking
    A --> C[🔍 goodFeaturesToTrack<br/>Найти угловые точки]
    B --> D[🔍 goodFeaturesToTrack<br/>Найти угловые точки]
    
    %% Optical Flow
    C --> E[🔄 calcOpticalFlowPyrLK<br/>Отследить точки]
    D --> E
    
    %% Descriptors
    C --> F[📝 ORB::create + compute<br/>Вычислить дескрипторы]
    D --> G[📝 ORB::create + compute<br/>Вычислить дескрипторы]
    
    %% Matching
    F --> H[🔗 BFMatcher<br/>Сопоставить дескрипторы]
    G --> H
    
    %% Motion Estimation
    E --> I[🎯 findEssentialMat<br/>Essential Matrix]
    H --> I
    
    I --> J[📍 recoverPose<br/>R, t матрицы]
    
    %% 3D Reconstruction
    E --> K[🔺 triangulatePoints<br/>3D координаты]
    J --> K
    
    %% Pose Estimation
    K --> L[🎯 solvePnP<br/>Оценить позу]
    J --> L
    
    %% RANSAC & Filtering
    L --> M[🛡️ solvePnPRansac<br/>Фильтрация выбросов]
    
    %% Homography (alternative)
    H --> N[📐 findHomography<br/>Гомографическое преобразование]
    
    %% Bundle Adjustment
    M --> O[⚖️ Bundle Adjustment<br/>Оптимизация позы и точек]
    K --> O
    
    %% Loop Closure
    O --> P[🔄 Loop Closure Detection<br/>Обнаружение замыкания]
    
    %% Keyframe Management
    P --> Q[📸 Keyframe Selection<br/>Выбор ключевых кадров]
    
    %% Mapping
    Q --> R[🗺️ Local Mapping<br/>Управление локальной картой]
    
    %% Global Optimization
    R --> S[🌍 Global Optimization<br/>Глобальная оптимизация]
    
    %% Output
    S --> T[🎯 Финальная поза камеры]
    S --> U[🗺️ 3D карта окружения]
    
    %% Styling
    classDef implemented fill:#90EE90,stroke:#006400,stroke-width:2px
    classDef notImplemented fill:#FFB6C1,stroke:#8B0000,stroke-width:2px
    classDef input fill:#87CEEB,stroke:#0066CC,stroke-width:2px
    classDef output fill:#DDA0DD,stroke:#800080,stroke-width:2px
    
    class A,B input
    class T,U output
    class C,D,E,F,G,I,J implemented
    class H,K,L,M,N,O,P,Q,R,S notImplemented
```

## Легенда

- 🟢 **Зеленые узлы** - Реализованные функции (Visual Odometry)
- 🔴 **Красные узлы** - Не реализованные функции (полный SLAM)
- 🔵 **Синие узлы** - Входные данные
- 🟣 **Фиолетовые узлы** - Выходные данные

## Описание потоков

1. **Feature Detection** → Находят угловые точки в кадрах
2. **Optical Flow** → Отслеживают движение точек между кадрами
3. **Descriptors** → Вычисляют дескрипторы для сопоставления
4. **Matching** → Сопоставляют точки между кадрами
5. **Motion Estimation** → Оценивают движение камеры
6. **3D Reconstruction** → Восстанавливают 3D структуру
7. **Pose Estimation** → Уточняют позу камеры
8. **Optimization** → Оптимизируют результаты
9. **Mapping** → Строят карту окружения

**Текущий статус**: Реализован только Visual Odometry (узлы 1-6), остальное требует доработки. 