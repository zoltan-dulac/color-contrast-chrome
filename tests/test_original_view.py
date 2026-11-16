from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
demo = (ROOT/'library'/'demo.js').read_text()
assert "preview.replaceChildren(masked ? current.compositeCanvas : originalImage)" in demo
assert "new Image()" in demo
assert "URL.createObjectURL(file)" in demo
assert "current.originalCanvas" not in demo, 'Demo should show original upload directly'
assert "CCAContrastRenderer.composeMask(mask, original.data)" in (ROOT/'library'/'contrast-analyzer.js').read_text()
assert "CCAContrastRenderer.composeMask(image, cvData)" in (ROOT/'image_analysis.js').read_text()
print('Original screenshot display and shared mask renderer checks passed')
