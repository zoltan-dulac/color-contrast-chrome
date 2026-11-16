# HTML text contrast mode (experimental)

This mode is **separate from the original screenshot contrast-boundary scanner**. In the extension popup, choose **Analyze HTML text contrast**. The extension opens an accessible in-page panel that shows numbers of failing, passing and unassessed rendered text runs. Failures are highlighted with amber shading and red outlines directly on the page. Results can be navigated by keyboard, and the panel has WCAG AA/AAA, Rescan, Hide/Show highlights and Close controls (Escape closes when the panel has focus).

The analyser considers DOM text nodes (not all text-like content), their computed foreground colours, font size/weight, and solid ancestor background colours. Transparent CSS colours are composited against ancestor backgrounds; the colour contrast formula is WCAG 2.x relative luminance. Normal text is tested against 4.5:1 (AA) or 7:1 (AAA); large text (at least 24 CSS px, or at least 18⅔ CSS px with weight >= 700) uses 3:1 (AA) or 4.5:1 (AAA).

## Limits: do not treat the results as a conformance verdict

* Text over CSS background images or gradients, opacity/filter/blend effects, and unsupported CSS colours is counted as **not assessed**, not assumed passing. Backgrounds formed by overlays or overlapping positioned elements may be undetected, and anti-aliasing is not considered.
* Does not examine generated pseudo-element content, text painted in canvas or SVG, closed/open shadow-root text, or text inside iframes. Does not identify images of text, non-text contrast, or input placeholder text. The original screenshot mode remains available for visuals and image backgrounds.
* Highlight rectangles follow DOM text ranges, not exact letter outlines; they show the approximate location of a failing text run. The results are snapshots; use **Rescan** after DOM or style updates.
* Capped to 12,000 potential text nodes and 250 stored failures (the first 100 are navigable) to limit page slowdowns; the panel reports partial results if a limit is reached.
* CSS pixels are used to position highlights, so Retina pixel density does not change positions.

## Architecture

`text-contrast.js` is a shared content script included by both `manifests/chrome.json` and `manifests/firefox.json`. A new button in `popup.html` sends `cca_toggle_text_contrast` to that script. It does not use screenshot permissions or change the existing `background-mv3.js` capture path. The results panel and overlays are isolated in a Shadow DOM and can be removed using Close or the toolbar command again.

## Smoke test

Build with `python3 build.py`, load `dist/chrome/` using Chrome Developer mode or load `dist/firefox/manifest.json` via Firefox `about:debugging`. Test an HTTP(S) page containing normal-sized #aaa text on white (should fail AA at ~2.32:1), black text on white (should pass), large #999 text on white (should fail AA at ~2.85:1), and white text over a CSS gradient (should be unassessed). Verify highlights, keyboard navigation, WCAG AA/AAA, Rescan, toggle, Close and both displays.

A reproducible manual testing page is provided at `tests/text-contrast-fixture.html`. Serve it over HTTP(S) (e.g., `python3 -m http.server 8765` from the repository root, then open `http://localhost:8765/tests/text-contrast-fixture.html`), because many browsers do not permit WebExtension content scripts on local `file:` pages.

The legacy message listeners in `page.js` and `isLoad.js` now return `false` for messages they do not handle, ensuring that the HTML-text mode gets a response without competing message channels.
