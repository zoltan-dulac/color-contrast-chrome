# Firefox region capture lock fix

## Cause

`begin("capture_area")` used to keep the global `job` lock while awaiting a
`show_selection_area` message. In Firefox, the content script returned `true`
(indicating an asynchronous response) but never called its response callback.
The sendMessage promise could remain unresolved, leaving `job` occupied.
When OK sent `capture_selected`, the background listener rejected it as
"Another screenshot capture is already in progress".

## Changes

- `background-mv3.js`: release `job` before awaiting the region-selection
  message, and use the explicit tab ID. Clear `selectionTab` if messaging fails.
- `page.js`: respond synchronously to `show_selection_area` with `{ok:true}`
  instead of returning `true` without responding.

## Testing

1. Build using `python3 build.py`, load `dist/firefox/manifest.json` via
   `about:debugging`, and refresh the webpage.
2. Choose Capture Page Region; select an area and press OK.
3. Check the extension's background console for `[CCA] Region confirmed` and
   `[CCA] Region capture completed`, and confirm analyzer output.
4. Repeat without restarting Firefox; test Chrome from `dist/chrome/`.

This is a source-level fix and has not been browser-tested end-to-end.
