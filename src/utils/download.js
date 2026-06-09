export function downloadBlob(contents, { filename, type }) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);

  try {
    downloadUrl(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadCanvasPng(canvas, filename) {
  if (!canvas) return;
  downloadUrl(canvas.toDataURL('image/png'), filename);
}

function downloadUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
