/** The Android host only injects this bridge into the bundled local application. */
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

export function postNativeMessage(message: object): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (window.ReactNativeWebView) {
    const reader = new FileReader();
    reader.onload = () => postNativeMessage({
      type: "download",
      filename,
      mime: blob.type.split(";")[0] || "application/octet-stream",
      base64: String(reader.result).split(",")[1],
    });
    reader.onerror = () => postNativeMessage({
      type: "error", message: "The export could not be prepared. Please try again.",
    });
    reader.readAsDataURL(blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
