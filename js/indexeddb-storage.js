const autoSaveDbName = "tegaki-memo-db";
const autoSaveDbVersion = 1;
const autoSaveStoreName = "autosave";
const autoSaveRecordKey = "latest";

function openAutoSaveDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(autoSaveDbName, autoSaveDbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(autoSaveStoreName)) {
        db.createObjectStore(autoSaveStoreName, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB open request was blocked."));
  });
}

function runAutoSaveTransaction(mode, callback) {
  return openAutoSaveDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(autoSaveStoreName, mode);
    const store = transaction.objectStore(autoSaveStoreName);
    let requestResult;

    transaction.oncomplete = () => {
      db.close();
      resolve(requestResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction was aborted."));
    };

    try {
      const request = callback(store);
      if (request) {
        request.onsuccess = () => {
          requestResult = request.result;
        };
        request.onerror = () => {
          transaction.abort();
        };
      }
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

async function saveAutoSaveProject(projectState) {
  const record = {
    key: autoSaveRecordKey,
    savedAt: new Date().toISOString(),
    appVersion: typeof APP_VERSION === "string" ? APP_VERSION : null,
    project: projectState
  };

  await runAutoSaveTransaction("readwrite", (store) => store.put(record));
  return true;
}

async function loadAutoSaveProject() {
  const record = await runAutoSaveTransaction("readonly", (store) => store.get(autoSaveRecordKey));
  return record?.project || null;
}

async function deleteAutoSaveProject() {
  await runAutoSaveTransaction("readwrite", (store) => store.delete(autoSaveRecordKey));
  return true;
}
