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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.getElementById('screenshot').files[0];
  if (!file) return;
  // Use a separate HTMLImageElement with its original Blob URL for the
  // unmasked view. This prevents accidentally showing a processed canvas.
  const nextUrl = URL.createObjectURL(file);
  const nextImage = new Image();
  nextImage.className = 'result-canvas';
  nextImage.alt = 'Original screenshot uploaded for analysis';
  nextImage.src = nextUrl;
  try {
    await nextImage.decode();
  } catch (error) {
    URL.revokeObjectURL(nextUrl);
    status.textContent = `Unable to decode screenshot: ${error.message}`;
    return;
  }
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = nextUrl;
  originalImage = nextImage;
  document.getElementById('scan').disabled = true;
  status.textContent = 'Scanning…';
  results.hidden = true;
  try {
    current = await analyzer.analyze(file, {
      level: document.getElementById('level').value,
      radius: Number(document.getElementById('radius').value),
      onProgress: percentage => { status.textContent = `Scanning: ${percentage}%`; }
    });
    current.compositeCanvas.className = 'result-canvas';
    showMask.checked = true;
    showSelectedView();
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
showMask.addEventListener('change', showSelectedView);
window.addEventListener('pagehide', () => {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  if (originalUrl) URL.revokeObjectURL(originalUrl);
});
