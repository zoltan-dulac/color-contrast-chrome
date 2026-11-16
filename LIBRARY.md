# Embeddable screenshot colour contrast analysis library

This repository builds **Chrome**, **Firefox**, and a **website JavaScript library** from a shared scan implementation. The library processes a user-selected screenshot entirely inside the visitor’s browser using a Web Worker. It requires no extension permissions, services or external packages.

## Build

```sh
python3 build.py                 # all three outputs
python3 build.py library         # website library only
python3 build.py chrome firefox # extensions only
```

The website output is `dist/library/` containing:

- `contrast-analyzer.js` — browser-facing API, bundled with the shared mask renderer
- `contrast-worker.js` — the **exact scan worker source** used in both extensions
- `demo.html`, `demo.js`, `demo.css` — standalone accessible upload UI
- `license.txt` — license notices

The build also creates `dist/color-contrast-library.zip` (and two extension ZIPs). **Commit the `shared/`, `library/`, and `build.py` files, not `dist/`.** The extensions’ original `background-image-analysis.js` is generated from `shared/contrast-worker.js` and not maintained separately.

## Try the upload demo

Because Web Workers commonly do not load correctly from `file://`, serve the `dist/library` folder over HTTP:

```sh
cd dist/library
python3 -m http.server 8000
```

Navigate to `http://localhost:8000/demo.html`, choose an image and press **Scan screenshot**. The file stays in browser memory. Use the controls to change threshold and radius, then rescan. The mask can be hidden, and the masked result can be downloaded as PNG.

## Embed the JS library in your webpage

Copy `contrast-analyzer.js` and `contrast-worker.js` to the **same public directory** on your site (or specify `workerUrl`). Include:

```html
<script src="/assets/contrast-analyzer.js"></script>
```

Example:

```html
<input type="file" id="screenshot" accept="image/*">
<output id="progress" aria-live="polite"></output>
<div id="result"></div>
<script src="/assets/contrast-analyzer.js"></script>
<script>
  const analyzer = new CCAContrastAnalyzer();
  document.getElementById('screenshot').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const result = await analyzer.analyze(file, {
      level: 'WCAG-aa-small', radius: 2,
      onProgress: n => { document.getElementById('progress').textContent = n + '%'; }
    });
    // Gives you full-resolution canvas pixels, while allowing CSS to scale display.
    result.compositeCanvas.style.maxWidth = '100%';
    result.compositeCanvas.style.height = 'auto';
    document.getElementById('result').replaceChildren(result.compositeCanvas);
  });
</script>
```

`new CCAContrastAnalyzer({workerUrl:'/assets/contrast-worker.js'})` can be used when the JS and worker are in different directories. The worker must be served with an appropriate JavaScript MIME type and be allowed by your Content Security Policy (`worker-src 'self'` for same-origin use).

### analyze(source, options)

`source`: an image `File`/`Blob`, image URL (subject to browser canvas CORS), `<img>`, `<canvas>`, `ImageBitmap`, or `ImageData`.

`options`:
- `level`: `WCAG-aa-small` (4.5:1 default), `WCAG-aa-large` (3:1), `WCAG-aaa-small` (7:1), or `WCAG-aaa-large` (4.5:1)
- `threshold`: numeric contrast threshold between 1 and 21 (overrides `level`)
- `radius`: integer 1–3, default 2, measured in **screenshot pixels**
- `onProgress(percent)`: optional progress callback
- `signal`: optional `AbortSignal` to cancel analysis

Promise result: `{width, height, threshold, radius, mask, originalCanvas, maskCanvas, compositeCanvas}`. `mask` is a `Uint8Array` of grayscale pixel values; `compositeCanvas` is a 75% mask/25% source blend, matching the extension.

## Limitations

The detector finds **contrasting pixel boundaries**, not HTML text nodes or WCAG failures. It does not decide whether text is large or bold. Uploaded screenshots must already be captured by the visitor, and the pixel radius is in screenshot (physical) pixels. Extremely large screenshots use substantial browser memory and analysis time. Browser caps on canvas size may apply.

The scan algorithm is the unmodified algorithm from the source extension (including its legacy contrast-ratio rounding behavior), not an independent reimplementation. `shared/contrast-renderer.js` is also used by both extensions.

## Screenshot fidelity and mask toggle

The demo now uses the original uploaded file as an `<img>` for the **mask hidden** view, and the generated composite canvas only for the **mask visible** view. Nothing is drawn onto the original. The worker and 75% mask composite are shared with the extensions and have not been changed.

**Important:** Upload an unmodified screenshot. If the selected PNG/JPEG already contains a contrast mask (for example, one downloaded from the extension with the mask enabled), no renderer can recover the missing original pixels; the unmasked view will correctly display the uploaded, already-masked file.

Use the same screenshot file, WCAG threshold and radius in both environments to compare results. Differences from re-capturing live content, image compression, scaling, or a changing animation can produce different edge detections.
