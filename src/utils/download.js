export function downloadBlob(contents, { filename, type }) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);

  try {
    downloadUrl(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
  });
}

export async function downloadCanvasImage(canvas, filename, { type = 'image/png', quality } = {}) {
  if (!canvas) return;
  const blob = await canvasToBlob(canvas, type, quality);
  const url = URL.createObjectURL(blob);
  try {
    downloadUrl(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyCanvasToClipboard(canvas) {
  if (!canvas) return;
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard image copy is not supported in this browser.');
  }
  const blob = await canvasToBlob(canvas, 'image/png');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function downloadUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
