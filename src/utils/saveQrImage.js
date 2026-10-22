export async function prepareQrImage(url, filename, { signal } = {}) {
  const response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error('QR_IMAGE_FETCH_FAILED');
  const blob = await response.blob();
  if (blob.type.split(';')[0] !== 'image/png' || !blob.size) {
    throw new Error('QR_IMAGE_INVALID');
  }
  return new File([blob], filename, { type: 'image/png' });
}

export async function saveQrImage(file) {
  if (typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })) {
    // Call share directly from the click, using the file prepared beforehand.
    await navigator.share({ files: [file], title: 'QR ชำระค่าบริการ' });
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
