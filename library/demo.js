const analyzer = new CCAContrastAnalyzer();
const form = document.getElementById('scanForm');
const status = document.getElementById('status');
const results = document.getElementById('results');
const preview = document.getElementById('preview');
const download = document.getElementById('download');
const showMask = document.getElementById('showMask');
let current = null;
let downloadUrl = null;
let originalUrl = null;
let originalImage = null;

// The unmasked view is always the uploaded file itself, not an image that
// has passed through the contrast compositor or any intermediate canvas.
function showSelectedView() {
  if (!current || !originalImage) return;
  const masked = showMask.checked;
  preview.replaceChildren(masked ? current.compositeCanvas : originalImage);
  preview.setAttribute('aria-label', masked
    ? 'Uploaded screenshot with contrast analysis mask applied'
    : 'Original uploaded screenshot without a contrast analysis mask');
}

// The submit status updates immediately, even if Safari stalls while loading
// an image or creating a worker.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const scanButton = document.getElementById('scan');
  const file = document.getElementById('screenshot').files[0];
  if (!file) {
    status.textContent = 'Select an image before scanning.';
    return;
  }
  scanButton.disabled = true;
  results.hidden = true;
  status.textContent = 'Loading screenshot…';
  let nextUrl = null;
  try {
    nextUrl = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.className = 'result-canvas';
    nextImage.alt = 'Original screenshot uploaded for analysis';
    // Attach listeners before setting src; Safari can otherwise miss load.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out loading the selected screenshot')), 30000);
      nextImage.onload = () => { clearTimeout(timeout); resolve(); };
      nextImage.onerror = () => { clearTimeout(timeout); reject(new Error('Safari could not load the selected screenshot')); };
      nextImage.src = nextUrl;
    });
    status.textContent = 'Scanning screenshot…';
    const nextResult = await analyzer.analyze(nextImage, {
      level: document.getElementById('level').value,
      radius: Number(document.getElementById('radius').value),
      onProgress: percentage => { status.textContent = `Scanning: ${percentage}%`; }
    });
    nextResult.compositeCanvas.className = 'result-canvas';
    // Prepare download before updating the UI. Safari's canvas.toBlob can
    // fail or return null, so report that separately from scan completion.
    current = nextResult;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = nextUrl;
    nextUrl = null;
    originalImage = nextImage;
    showMask.checked = true;
    showSelectedView();
    results.hidden = false;
    status.textContent = `Complete. Analyzed ${current.width} by ${current.height} pixels.`;
    try {
      const blob = await new Promise((resolve, reject) =>
        current.compositeCanvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to encode PNG')), 'image/png'));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      download.href = downloadUrl;
      download.hidden = false;
    } catch (error) {
      download.hidden = true;
      console.error('Unable to prepare masked PNG:', error);
      status.textContent += ' Download could not be prepared.';
    }
  } catch (error) {
    console.error('Screenshot analysis failed:', error);
    status.textContent = `Analysis failed: ${error && error.message ? error.message : String(error)}`;
    if (nextUrl) URL.revokeObjectURL(nextUrl);
  } finally {
    scanButton.disabled = false;
  }
});
showMask.addEventListener('change', showSelectedView);
window.addEventListener('pagehide', () => {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  if (originalUrl) URL.revokeObjectURL(originalUrl);
});
