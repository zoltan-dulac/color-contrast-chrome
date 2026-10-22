# Chrome and Firefox from one repository

The application code is shared. The browser-specific manifests are in `manifests/chrome.json` and `manifests/firefox.json`.

## Build

From this repository root run:

```sh
python3 build.py
```

Generated artifacts (not checked into source control):
- `dist/chrome/` — Chrome/Chromium unpacked extension
- `dist/firefox/` — Firefox temporary add-on
- `dist/color-contrast-chrome.zip` — Chrome package
- `dist/color-contrast-firefox.zip` — Firefox package

## Load in Chrome

Open `chrome://extensions`, turn on Developer mode, select **Load unpacked**, and select `dist/chrome/`.

## Load in Firefox

Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select `dist/firefox/manifest.json`. Temporary add-ons disappear after Firefox restarts. For a permanent release, sign the Firefox build with Mozilla Add-ons.

## Architecture

Chrome Manifest V3 requires a background service worker, while Firefox Manifest V3 uses an extension background event page (`background.scripts`). Both run the shared `background-mv3.js`. The analyzer UI, capture logic, content scripts, CSS, and images remain shared.

The existing `chrome.*` namespace is retained because Firefox supports it for WebExtensions. Manifest changes should be made in the browser-specific JSON files, not `dist/`.

## Notes / testing

This is a cross-browser port, not a verified Firefox release. Chrome screenshot capture worked in the supplied original. Firefox has not been exercised in this environment. Start by testing Capture Window, then full-page capture, selected-area capture, analysis, mask toggling, Download, and browser screen-density changes. File URLs may need separate Firefox treatment and are excluded from Firefox matches. The original `capture_screen` feature is not implemented in the MV3 coordinator.

The `.git` directory from the uploaded archive is intentionally excluded from the distributable source archive. Keep your existing Git repository when applying these changes; use Git to review differences before committing.
