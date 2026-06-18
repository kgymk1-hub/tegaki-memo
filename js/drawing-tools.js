function showDrawingUnavailableHint(message) {
  hint.textContent = message;
  setHintVisible(true);
}

function resetDrawingState() {
  isDrawing = false;
  lastPoint = null;
  previousPoint = null;
  shapeStartPoint = null;
}

function canDrawOnActiveLayer({ showHint = false } = {}) {
  const activeLayer = getActiveLayer();

  if (!activeLayer) {
    if (showHint) {
      showDrawingUnavailableHint(noDrawableLayerMessage);
    }
    return false;
  }

  if (!activeLayer.visible) {
    if (showHint) {
      showDrawingUnavailableHint(hiddenLayerDrawingMessage);
    }
    return false;
  }

  return true;
}

function getDrawingContext() {
  const activeLayer = getActiveLayer();
  if (!canDrawOnActiveLayer()) return null;
  return activeLayer.ctx;
}
function applyStrokeStyle(targetCtx, options = {}) {
  const tool = options.tool || currentTool;

  targetCtx.lineWidth = currentSize;
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.setLineDash([]);

  if (tool === "eraser") {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.globalAlpha = 1;
    targetCtx.strokeStyle = "rgba(0, 0, 0, 1)";
    targetCtx.fillStyle = "rgba(0, 0, 0, 1)";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.globalAlpha = tool === "marker" ? 0.35 : 1;
    targetCtx.strokeStyle = currentColor;
    targetCtx.fillStyle = currentColor;
  }

  if (tool === "dashedLine") {
    targetCtx.setLineDash([Math.max(8, currentSize * 2), Math.max(6, currentSize * 1.5)]);
  }
}

function resetAfterDrawing(targetCtx) {
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.globalAlpha = 1;
  targetCtx.setLineDash([]);
}
function isShapeTool(tool = currentTool) {
  return ["line", "rect", "ellipse", "arrow", "dashedLine"].includes(tool);
}

function getTextFontSize() {
  if (currentSize <= 3) return 16;
  if (currentSize <= 7) return 24;
  if (currentSize <= 14) return 36;
  return 48;
}

function drawDot(point) {
  const targetCtx = getDrawingContext();
  if (!targetCtx) return;

  applyStrokeStyle(targetCtx);
  targetCtx.beginPath();
  targetCtx.arc(point.x, point.y, currentSize / 2, 0, Math.PI * 2);
  targetCtx.fill();
  const activeLayer = getActiveLayer();
  if (activeLayer && currentTool !== "eraser") activeLayer.hasContent = true;
  resetAfterDrawing(targetCtx);
}

function drawSmoothLine(point) {
  const targetCtx = getDrawingContext();
  if (!targetCtx) return;

  applyStrokeStyle(targetCtx);

  if (!lastPoint) {
    drawDot(point);
    lastPoint = point;
    previousPoint = point;
    return;
  }

  const midPoint = {
    x: (lastPoint.x + point.x) / 2,
    y: (lastPoint.y + point.y) / 2
  };

  targetCtx.beginPath();
  targetCtx.moveTo(previousPoint.x, previousPoint.y);
  targetCtx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
  targetCtx.stroke();
  const activeLayer = getActiveLayer();
  if (activeLayer && currentTool !== "eraser") activeLayer.hasContent = true;
  resetAfterDrawing(targetCtx);

  previousPoint = midPoint;
  lastPoint = point;
}

function drawShape(targetCtx, startPoint, endPoint, tool = currentTool) {
  applyStrokeStyle(targetCtx, { tool });
  targetCtx.beginPath();

  if (tool === "rect") {
    targetCtx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    targetCtx.stroke();
  } else if (tool === "ellipse") {
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;
    const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
    const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
    targetCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    targetCtx.stroke();
  } else {
    targetCtx.moveTo(startPoint.x, startPoint.y);
    targetCtx.lineTo(endPoint.x, endPoint.y);
    targetCtx.stroke();

    if (tool === "arrow") {
      const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
      const headLength = Math.max(14, currentSize * 3);
      targetCtx.beginPath();
      targetCtx.moveTo(endPoint.x, endPoint.y);
      targetCtx.lineTo(endPoint.x - headLength * Math.cos(angle - Math.PI / 6), endPoint.y - headLength * Math.sin(angle - Math.PI / 6));
      targetCtx.moveTo(endPoint.x, endPoint.y);
      targetCtx.lineTo(endPoint.x - headLength * Math.cos(angle + Math.PI / 6), endPoint.y - headLength * Math.sin(angle + Math.PI / 6));
      targetCtx.stroke();
    }
  }

  const activeLayer = getActiveLayer();
  if (targetCtx !== ctx && activeLayer && tool !== "eraser") activeLayer.hasContent = true;
  resetAfterDrawing(targetCtx);
}

function drawShapePreview(endPoint) {
  if (!shapeStartPoint) return;
  renderAllLayers();
  ctx.save();
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  drawShape(ctx, shapeStartPoint, endPoint);
  ctx.restore();
  resetDisplaySettings();
}

function drawTextAt(point) {
  const activeLayer = getActiveLayer();

  const finishTextTool = () => {
    setTool("pen");
    setHintVisible(false);
  };

  if (!canDrawOnActiveLayer({ showHint: true })) {
    resetDrawingState();
    return;
  }

  const text = window.prompt("入力する文字を入力してください。");
  if (text === null) {
    finishTextTool();
    return;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    finishTextTool();
    return;
  }

  saveHistory();

  const targetCtx = activeLayer.ctx;
  applyStrokeStyle(targetCtx, { tool: "pen" });
  targetCtx.font = `${getTextFontSize()}px sans-serif`;
  targetCtx.textBaseline = "top";
  targetCtx.fillText(trimmedText, point.x, point.y);
  activeLayer.hasContent = true;
  resetAfterDrawing(targetCtx);
  renderAllLayers();
  finishTextTool();
  scheduleAutoSave();
}

function startDrawing(event) {
  event.preventDefault();

  if (pendingImage) {
    startPendingImageDrag(event);
    return;
  }

  if (currentTool === "select") {
    const point = getPointerCanvasPoint(event);
    if (startSelection(point)) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_) {
        // Pointer Capture非対応環境では無視する。
      }
    }
    return;
  }

  if (!canDrawOnActiveLayer({ showHint: true })) {
    resetDrawingState();
    return;
  }

  const point = getPointerPoint(event);

  if (currentTool === "text") {
    drawTextAt(point);
    return;
  }

  if (!isShapeTool()) {
    saveHistory();
  }

  setHintVisible(false);
  isDrawing = true;
  lastPoint = point;
  previousPoint = point;
  shapeStartPoint = isShapeTool() ? point : null;

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Capture非対応環境では無視する。
  }

  if (!isShapeTool()) {
    drawDot(point);
  }
  renderAllLayers();
}

function draw(event) {
  if (pendingImage) {
    movePendingImage(event);
    return;
  }

  if (isSelecting) {
    event.preventDefault();
    updateSelection(getPointerCanvasPoint(event));
    return;
  }

  if (!isDrawing) return;
  event.preventDefault();

  if (isShapeTool()) {
    drawShapePreview(getPointerPoint(event));
    return;
  }

  const events = typeof event.getCoalescedEvents === "function"
    ? event.getCoalescedEvents()
    : [event];

  for (const coalescedEvent of events) {
    drawSmoothLine(getPointerPoint(coalescedEvent));
  }

  requestRenderAllLayers();
}

function getPointDistance(startPoint, endPoint) {
  if (!startPoint || !endPoint) return 0;
  return Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
}

function stopDrawing(event) {
  if (pendingImage) {
    stopPendingImageDrag(event);
    return;
  }

  if (isSelecting) {
    event.preventDefault();
    finishSelection(getPointerCanvasPoint(event));
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer Capture非対応環境では無視する。
    }
    return;
  }

  if (!isDrawing) return;
  event.preventDefault();

  const targetCtx = getDrawingContext();
  const endPoint = getPointerPoint(event);
  let didChangeCanvas = false;

  if (targetCtx && isShapeTool() && shapeStartPoint) {
    if (getPointDistance(shapeStartPoint, endPoint) >= minShapeDistance) {
      saveHistory();
      drawShape(targetCtx, shapeStartPoint, endPoint);
      didChangeCanvas = true;
    }
  } else if (targetCtx && lastPoint && previousPoint) {
    applyStrokeStyle(targetCtx);
    targetCtx.beginPath();
    targetCtx.moveTo(previousPoint.x, previousPoint.y);
    targetCtx.lineTo(lastPoint.x, lastPoint.y);
    targetCtx.stroke();
    if (currentTool !== "eraser") {
      const activeLayer = getActiveLayer();
      if (activeLayer) activeLayer.hasContent = true;
    }
    resetAfterDrawing(targetCtx);
    didChangeCanvas = true;
  }

  resetDrawingState();

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Capture非対応環境では無視する。
  }

  renderAllLayers();

  if (didChangeCanvas) {
    scheduleAutoSave();
  }
}
function setTool(tool) {
  if (isPlacingImage()) return;

  currentTool = tool;
  if (tool === "select") openQuickPanel("selection");
  refreshHint();
  updateToolButtons();
  scheduleAutoSave();
}
