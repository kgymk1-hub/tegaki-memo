function getDisplaySize() {
  const rect = canvasWrap.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  };
}

function getPointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getPointerCanvasPoint(event) {
  const point = getPointerPoint(event);
  return {
    x: point.x * renderScale,
    y: point.y * renderScale
  };
}


function createLayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSnapshotFromCanvas(sourceCanvas) {
  if (!sourceCanvas.width || !sourceCanvas.height) return null;

  const snapshot = document.createElement("canvas");
  snapshot.width = sourceCanvas.width;
  snapshot.height = sourceCanvas.height;

  const snapshotCtx = snapshot.getContext("2d");
  if (!snapshotCtx) return null;

  snapshotCtx.drawImage(sourceCanvas, 0, 0);
  return snapshot;
}
