function getDisplaySize() {
  const rect = canvasWrap.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  };
}

function getPointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasWidth / Math.max(1, rect.width);
  const scaleY = canvasHeight / Math.max(1, rect.height);
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function getPointerCanvasPoint(event) {
  const point = getPointerPoint(event);
  return {
    x: point.x * renderScale,
    y: point.y * renderScale
  };
}

function clampViewZoom(zoom) {
  return Math.min(maxViewZoom, Math.max(minViewZoom, zoom));
}

function applyViewZoom(options = {}) {
  const previousLeft = canvasWrap.scrollLeft;
  const previousTop = canvasWrap.scrollTop;
  const previousZoom = viewZoom || 1;

  viewZoom = clampViewZoom(viewZoom || 1);
  canvas.style.width = `${canvasWidth * viewZoom}px`;
  canvas.style.height = `${canvasHeight * viewZoom}px`;
  if (zoomValue) zoomValue.textContent = `${Math.round(viewZoom * 100)}%`;

  if (options.centerPoint && options.clientPoint) {
    const targetLeft = (options.centerPoint.x / renderScale) * viewZoom - (options.clientPoint.x - canvasWrap.getBoundingClientRect().left);
    const targetTop = (options.centerPoint.y / renderScale) * viewZoom - (options.clientPoint.y - canvasWrap.getBoundingClientRect().top);
    canvasWrap.scrollLeft = Math.max(0, targetLeft);
    canvasWrap.scrollTop = Math.max(0, targetTop);
  } else if (options.preserveScroll && previousZoom > 0) {
    const ratio = viewZoom / previousZoom;
    canvasWrap.scrollLeft = previousLeft * ratio;
    canvasWrap.scrollTop = previousTop * ratio;
  }
}

function updateCanvasSizeInputs() {
  if (canvasWidthInput) canvasWidthInput.value = canvas.width;
  if (canvasHeightInput) canvasHeightInput.value = canvas.height;
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
