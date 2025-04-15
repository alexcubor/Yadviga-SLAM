# Third-Party Licenses

This project uses the following third-party libraries:

## Emscripten

- **License**: MIT License
- **Source**: https://github.com/emscripten-core/emsdk
- **License Text**: https://github.com/emscripten-core/emsdk/blob/main/LICENSE
- **Note**: This project uses Emscripten as a build tool but does not include its source code. Users must install Emscripten separately using the provided build script `third_party/emsdk/build_emsdk.sh`. 

## OpenCV

- **License**: Apache License 2.0
- **Source**: https://opencv.org/
- **License Text**: https://opencv.org/license/
- **Note**: This project uses OpenCV as a dependency but does not include its source code. Users must build OpenCV separately using the provided build script `third_party/opencv/build_opencv.sh`.

### Apache License 2.0 Notice

This product uses software developed by the OpenCV team (https://opencv.org/).

The Apache License 2.0 requires that you include the following notice in your project:

```
Copyright 2004 OpenCV team

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
