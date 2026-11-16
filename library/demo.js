const analyzer = new CCAContrastAnalyzer();
const form = document.getElementById('scanForm');
const status = document.getElementById('status');
const results = document.getElementById('results');
const preview = document.getElementById('preview');
const download = document.getElementById('download');
const showMask = document.getElementById('showMask');
let current = null;
let downloadUrl = null;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.getElementById('screenshot').files[0];
  if (!file) return;
  document.getElementById('scan').disabled = true;
  status.textContent = 'Scanning…';
  results.hidden = true;
  try {
    current = await analyzer.analyze(file, {
      level: document.getElementById('level').value,
      radius: Number(document.getElementById('radius').value),
      onProgress: percentage => { status.textContent = `Scanning: ${percentage}%`; }
    });
    preview.replaceChildren();
    current.compositeCanvas.className = 'result-canvas';
    current.originalCanvas.className = 'result-canvas';
    showMask.checked = true;
    preview.append(current.compositeCanvas);
    const blob = await new Promise(resolve => current.compositeCanvas.toBlob(resolve, 'image/png'));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    download.href = downloadUrl;
    results.hidden = false;
    status.textContent = `Complete. Analyzed ${current.width} by ${current.height} pixels.`;
  } catch (error) {
    console.error(error);
    status.textContent = `Analysis failed: ${error.message}`;
  } finally {
    document.getElementById('scan').disabled = false;
  }
});
showMask.addEventListener('change', () => {
  if (current) preview.replaceChildren(showMask.checked ? current.compositeCanvas : current.originalCanvas);
});
window.addEventListener('pagehide', () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); });
