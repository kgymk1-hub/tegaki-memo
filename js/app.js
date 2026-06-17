async function initializeApp() {
  resizeCanvasIfNeeded();
  initializeLayers();
  bindEventListeners();
  updateHintText();
  updateToolButtons();
  updateUndoButton();
  updateBackgroundView();
  await restoreAutoSaveOnStartup();
  registerServiceWorker();
}

initializeApp();
