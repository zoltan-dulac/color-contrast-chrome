# Retina/HiDPI display sizing fix (second iteration)

- The previous code used `chrome.tabs.Tab.width`, which can be the wrong value for sizing a screenshot in CSS pixels. The service worker now reads `window.innerWidth`, `window.innerHeight`, and `devicePixelRatio` from the source tab before screenshot capture.
- The analyzer constrains the displayed image to the width of its scroll container, preserving aspect ratio. The native-resolution image data and contrast calculations are unchanged.
- The contrast mask and screenshot use the same displayed width/height, and resize together if the analyzer window changes width.
- Images taller than the available viewport still scroll vertically.

Note: interactions with the screenshot (drawing/editing coordinates) may need further testing when the displayed size differs from its backing resolution.
