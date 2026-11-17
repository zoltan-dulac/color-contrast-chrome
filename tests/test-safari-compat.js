/* Regression guard: browser library must not depend on Image.decode(). */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname,'..');
const demo = fs.readFileSync(path.join(base,'library/demo.js'),'utf8');
const api = fs.readFileSync(path.join(base,'library/contrast-analyzer.js'),'utf8');
assert(!/await\s+[^;\n]*\.decode\s*\(/.test(demo + api), 'Do not await HTMLImageElement.decode in Safari');
assert(demo.indexOf("status.textContent = 'Loading screenshot…'") < demo.indexOf('await new Promise'), 'Status must update before image load');
assert(/nextImage\.onload\s*=/.test(demo), 'Image load must resolve');
assert(/nextImage\.onerror\s*=/.test(demo), 'Image failure must reject');
assert(/worker\.onerror\s*=/.test(api), 'Worker errors must surface');
console.log('PASS Safari image loading and visible progress regression checks');
