# Chrome Manifest V3 migration (experimental)

Load this unpacked directory from `chrome://extensions` with Developer mode enabled. Refresh the test page after loading.

Changes: MV3 service worker, offscreen canvas screenshot processing, persistent screenshot handoff through chrome.storage.local, popup command messaging, native download replacing the old NPAPI plugin, modern permissions.

Known limits: full-page capture may have stitching issues on complicated pages; selecting regions is best-effort; old global hotkeys and native full-screen capture are unsupported; print and clipboard workflows require testing; capture works on ordinary HTTP(S) pages, not internal chrome:// pages. Enable **Allow access to file URLs** for local file testing.

For debugging: inspect the service worker on chrome://extensions; inspect the analyzer tab with DevTools. This package has been statically checked but not exercised inside Chrome.

2026-10-21 fix: Add activeTab permission for chrome.tabs.captureVisibleTab when Capture Window is launched from the extension popup.

2026-10-21 fix 2: Replace unsupported FileReaderSync in service worker with Blob.arrayBuffer() and chunked Base64 encoding for stored PNG screenshot.

## Analyzer scan fix
The canvas analysis now starts after the captured image has loaded and has been drawn. Previously, the analysis worker was started with the initial empty 300 x 150 canvas. The mask rendering now calls putImageData once after the full image is constructed, instead of once per scanline.

## Retina/HiDPI rendering fix
Captured image pixel dimensions remain unchanged for contrast analysis and exported PNGs. The original tab/page CSS dimensions are stored with each capture and used only for the displayed screenshot, drawing canvas, and contrast-mask overlay. Reload the extension after replacing files.
