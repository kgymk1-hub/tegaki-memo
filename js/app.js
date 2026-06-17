function initializeApp() {
  resizeCanvasIfNeeded();
  initializeLayers();
  bindEventListeners();
  updateHintText();
  updateToolButtons();
  updateUndoButton();
  updateBackgroundView();
  registerServiceWorker();
}

initializeApp();
