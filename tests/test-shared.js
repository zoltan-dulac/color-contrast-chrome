/* Run: node tests/test-shared.js (after python3 build.py). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared/contrast-worker.js'), 'utf8');
for (const target of ['chrome', 'firefox']) {
  const built = fs.readFileSync(path.join(root, `dist/${target}/background-image-analysis.js`), 'utf8');
  assert.equal(built, source, `${target} must use shared scanner`);
}
assert.equal(fs.readFileSync(path.join(root, 'dist/library/contrast-worker.js'), 'utf8'), source);
const messages = [];
const ctx = {postMessage: m => messages.push(m), Uint8Array, ArrayBuffer, Math, Date};
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(source, ctx);
const width = 8, height = 8;
const rgba = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const value = x < 4 ? 0 : 255;
  rgba.set([value, value, value, 255], (y * width + x) * 4);
}
ctx.onmessage({data: {width, height, iterations: 2, contrastLevel: 4.5, img: rgba.buffer}});
const result = messages.find(m => m && m.data instanceof ArrayBuffer);
assert(result, 'worker should return mask data');
const hash = crypto.createHash('sha256').update(Buffer.from(result.data)).digest('hex');
assert.equal(hash, 'fec0f57de0b19bc7dacb5b0fc3de7b56fc68dfdbeeebc8f9f4c506bf6e821c77', 'mask regression');
const rendererSrc = fs.readFileSync(path.join(root, 'shared/contrast-renderer.js'), 'utf8');
const render = {Uint8ClampedArray}; render.globalThis = render;
vm.createContext(render); vm.runInContext(rendererSrc, render);
const rgbaResult = render.CCAContrastRenderer.composeMask(new Uint8Array([255,0]), new Uint8ClampedArray([100,80,60,255,255,255,255,255]));
assert.deepEqual(Array.from(rgbaResult), [216,211,206,255,64,64,64,255]);
console.log('PASS shared worker, mask output, compositing across both extensions and library');
