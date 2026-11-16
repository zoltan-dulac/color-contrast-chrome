/* Shared mask compositing for the extension and the embeddable library.
 * Preserve the original extension's 75% greyscale mask / 25% screenshot mix.
 * The input mask bytes are 0, 85, 170 or 255 (radius-dependent).
 */
(function (root) {
  'use strict';
  function composeMask(mask, originalRGBA, opacity = 0.75) {
    if (!(opacity >= 0 && opacity <= 1)) throw new RangeError('opacity must be between 0 and 1');
    if (originalRGBA.length !== mask.length * 4) throw new RangeError('RGBA and mask dimensions do not match');
    const result = new Uint8ClampedArray(originalRGBA.length);
    for (let i = 0; i < mask.length; i++) {
      const index = i * 4;
      const grey = mask[i] * opacity;
      result[index] = grey + originalRGBA[index] * (1 - opacity);
      result[index + 1] = grey + originalRGBA[index + 1] * (1 - opacity);
      result[index + 2] = grey + originalRGBA[index + 2] * (1 - opacity);
      result[index + 3] = 255;
    }
    return result;
  }
  root.CCAContrastRenderer = Object.freeze({composeMask});
})(typeof globalThis === 'object' ? globalThis : self);
