# Normalized photo fixtures

Original test fixtures generated for Issue #13 with Pillow: solid red, green,
blue and yellow quadrants, JPEG quality 95. No external source or personal media.
Shapes: 3:4 portrait (300x400), 9:16 portrait (900x1600), square (400x400),
4:3 landscape (400x300), 16:9 landscape (1600x900), tiny (7x4).

These model the server-normalized JPEG after orientation/HEIC conversion, not
raw HEIC or EXIF decoder coverage. Backend PR #11 owns that decoder evidence.
Browser crop mocks use the exact saved integer square to canvas-render JPEG
thumbnails at min(size,640), without upscaling. Geometry/coordinates are exact;
interior quadrant color samples allow 64/255 channel deviation for browser JPEG
resampling/chroma loss. Tiny fixtures validate geometry only. Actual server
ImageMagick resampling and physical iPhone output require paired live QA.
