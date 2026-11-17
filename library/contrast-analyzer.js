/*
 * Contrast Analyzer for uploaded screenshots.
 * The worker and compositor are identical to those used by the browser extension.
 * Built artifact is one browser-side JS file plus its Web Worker.
 */
(function (root) {
  'use strict';
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  const defaultWorkerUrl = script && script.src ? new URL('contrast-worker.js', script.src).href : 'contrast-worker.js';
  const thresholds = Object.freeze({
    'WCAG-aa-small': 4.5,
    'WCAG-aa-large': 3,
    'WCAG-aaa-small': 7,
    'WCAG-aaa-large': 4.5
  });

  function canvasFromImageData(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d', {willReadFrequently: true}).putImageData(imageData, 0, 0);
    return canvas;
  }

  // Use image load/error events instead of HTMLImageElement.decode(). Safari
  // can leave decode() pending for local Blob URLs. Keep listeners attached
  // before assigning src, including for cached and very small images.
  function waitForImage(image, timeoutMs = 30000) {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);
    return new Promise((resolve, reject) => {
      let timeout;
      const cleanup = () => {
        clearTimeout(timeout);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
      };
      const loaded = () => {
        cleanup();
        image.naturalWidth > 0 ? resolve(image) : reject(new Error('The image has no pixels'));
      };
      const failed = () => {
        cleanup();
        reject(new Error('Unable to load the selected image'));
      };
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      timeout = setTimeout(() => { cleanup(); reject(new Error('Timed out loading the image')); }, timeoutMs);
      if (image.complete) {
        // Broken images may have completed before listeners were attached.
        image.naturalWidth > 0 ? loaded() : (image.src && failed());
      }
    });
  }

  async function loadCanvas(source) {
    if (source instanceof HTMLCanvasElement) return source;
    if (typeof ImageData !== 'undefined' && source instanceof ImageData) return canvasFromImageData(source);
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d').drawImage(source, 0, 0);
      return canvas;
    }
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      await waitForImage(source);
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      canvas.getContext('2d').drawImage(source, 0, 0);
      return canvas;
    }
    if (source instanceof Blob) {
      if (source.type && !source.type.startsWith('image/')) throw new TypeError('Please upload an image file.');
      const url = URL.createObjectURL(source);
      try { return await loadCanvasFromUrl(url); }
      finally { URL.revokeObjectURL(url); }
    }
    if (typeof source === 'string') return loadCanvasFromUrl(source);
    throw new TypeError('Expected an image File, Blob, image URL, canvas, ImageBitmap, or ImageData.');
  }
  async function loadCanvasFromUrl(url) {
    const img = new Image();
    const pending = waitForImage(img);
    img.src = url;
    await pending;
    return loadCanvas(img);
  }
  function paintedCanvas(width, height, rgba) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    return canvas;
  }

  class ContrastAnalyzer {
    constructor(options = {}) {
      this.workerUrl = options.workerUrl || defaultWorkerUrl;
    }

    // Analyzes a screenshot without sending it to a server. Each call uses
    // a separate worker, allowing the Promise to settle or reject independently.
    async analyze(source, options = {}) {
      const threshold = options.threshold !== undefined
        ? Number(options.threshold)
        : thresholds[options.level || 'WCAG-aa-small'];
      const radius = Number(options.radius ?? 2);
      if (!Number.isFinite(threshold) || threshold < 1 || threshold > 21)
        throw new RangeError('threshold must be between 1 and 21');
      if (!Number.isInteger(radius) || radius < 1 || radius > 3)
        throw new RangeError('radius must be an integer between 1 and 3');
      const canvas = await loadCanvas(source);
      const width = canvas.width, height = canvas.height;
      if (width < 1 || height < 1) throw new Error('The uploaded image is empty');
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      const original = ctx.getImageData(0, 0, width, height);
      // Transfer a copy; preserve original for displaying and downloading.
      const imageCopy = new Uint8Array(original.data);
      const mask = await new Promise((resolve, reject) => {
        let worker;
        try { worker = new Worker(this.workerUrl); }
        catch (error) { reject(error); return; }
        let settled = false;
        const fail = error => { if (!settled) { settled = true; worker.terminate(); reject(error); } };
        worker.onerror = event => {
          fail(new Error('Contrast analysis worker failed to load or execute: ' + (event.message || this.workerUrl)));
        };
        worker.onmessageerror = () => fail(new Error('The browser could not read the contrast worker response'));

        worker.onmessage = event => {
          const msg = event.data;
          if (msg && typeof msg === 'object' && msg.data instanceof ArrayBuffer) {
            settled = true;
            worker.terminate();
            resolve(new Uint8Array(msg.data));
          } else {
            let progress = msg && msg.status;
            if (typeof msg === 'string') {
              try { progress = JSON.parse(msg).status; } catch { /* ignore */ }
            }
            if (typeof progress === 'number' && typeof options.onProgress === 'function') {
              options.onProgress(Math.max(0, Math.min(100, progress)));
            }
          }
        };
        if (options.signal) {
          if (options.signal.aborted) { fail(new DOMException('Aborted','AbortError')); return; }
          options.signal.addEventListener('abort', () => fail(new DOMException('Aborted','AbortError')), {once:true});
        }
        try {
          worker.postMessage({width,height,iterations:radius,contrastLevel:threshold,img:imageCopy.buffer}, [imageCopy.buffer]);
        } catch (error) {
          // Some browser versions reject transferred buffers; a copied buffer
          // preserves the same worker protocol while avoiding the transfer list.
          try {
            worker.postMessage({width,height,iterations:radius,contrastLevel:threshold,img:new Uint8Array(original.data).buffer});
          } catch (fallbackError) {
            fail(fallbackError);
          }
        }
      });
      if (mask.length !== width * height) throw new Error('Contrast worker returned an invalid mask');
      const maskRGBA = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < mask.length; i++) {
        const index = i * 4;
        maskRGBA[index] = maskRGBA[index+1] = maskRGBA[index+2] = mask[i];
        maskRGBA[index+3] = 255;
      }
      const composite = CCAContrastRenderer.composeMask(mask, original.data);
      return {
        width, height, threshold, radius, mask,
        originalCanvas: canvas,
        maskCanvas: paintedCanvas(width, height, maskRGBA),
        compositeCanvas: paintedCanvas(width, height, composite)
      };
    }
  }
  ContrastAnalyzer.thresholds = thresholds;
  root.CCAContrastAnalyzer = ContrastAnalyzer;
})(typeof globalThis === 'object' ? globalThis : self);
