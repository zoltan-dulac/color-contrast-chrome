# Safari 26 screenshot upload compatibility

The demo previously awaited `HTMLImageElement.decode()` before changing its status. If decoding stalled or failed, clicking Scan appeared to do nothing. The upload and library image loader now use `load` / `error` events with a timeout. The demo reports **Loading screenshot**, **Scanning screenshot**, progress, and any failure. A loaded image is passed directly to the analyzer instead of decoding the same File a second time. PNG download failures no longer suppress otherwise successful results. The shared contrast worker and renderer have not changed.

To test: `python3 build.py`, `cd dist/library`, `python3 -m http.server 8000`, visit `http://localhost:8000/demo.html` in Safari, choose an image and Scan. Check the visible status; if the worker is blocked (such as when running from file://), an error should be displayed. Test with Chrome and Firefox too.
