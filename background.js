// Funciones de bookmarks
async function initializeBookmarkFolder() {
  const nodes = await chrome.bookmarks.search({title: 'TabSessions'});
  if (nodes.length === 0) {
    return chrome.bookmarks.create({
      title: 'TabSessions',
      parentId: '1'
    });
  }
  return nodes[0];
}

async function updateSessionBookmarks(sessionName, tabs, existingFolderId = null) {
  console.log('Updating bookmarks for:', sessionName, 'Folder ID:', existingFolderId);
  const root = await initializeBookmarkFolder();
  
  if (existingFolderId) {
    console.log('Existing folder found, updating content');
    const children = await chrome.bookmarks.getChildren(existingFolderId);
    for (const child of children) {
      await chrome.bookmarks.remove(child.id);
    }
    await chrome.bookmarks.update(existingFolderId, { title: sessionName });
  } else {
    console.log('Creating new folder for session');
    const folder = await chrome.bookmarks.create({
      parentId: root.id,
      title: sessionName
    });
    existingFolderId = folder.id;
  }

  console.log('Creating bookmarks for', tabs.length, 'tabs');
  for (const tab of tabs) {
    await chrome.bookmarks.create({
      parentId: existingFolderId,
      title: tab.title || tab.url,
      url: tab.url
    });
  }

  return existingFolderId;
}

// Variable global para el debounce
let updateTimeout = null;
let isUpdating = false;  // Semáforo para evitar actualizaciones simultáneas

// Event Listeners con debounce
chrome.tabs.onCreated.addListener((tab) => {
  scheduleUpdate(tab.windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    scheduleUpdate(tab.windowId);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  scheduleUpdate(removeInfo.windowId);
});

// Función para programar actualizaciones
function scheduleUpdate(windowId) {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  updateTimeout = setTimeout(() => {
    updateSessionOnTabChange(windowId);
  }, 2000); // Aumentamos el tiempo a 2 segundos
}

// Función mejorada para actualizar marcadores
async function updateSessionOnTabChange(windowId) {
  if (isUpdating) {
    console.log('Update already in progress, skipping...');
    return;
  }

  try {
    isUpdating = true;
    console.log('Starting update for window:', windowId);
    
    const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    if (!sessionName || !data.sessionMetadata[sessionName]) {
      console.log('No active session found for window:', windowId);
      return;
    }

    const tabs = await chrome.tabs.query({ windowId });
    if (!tabs || tabs.length === 0) {
      console.log('No tabs found in window:', windowId);
      return;
    }

    console.log('Updating session:', sessionName, 'with', tabs.length, 'tabs');
    
    await updateSessionBookmarks(
      sessionName, 
      tabs, 
      data.sessionMetadata[sessionName].bookmarkFolderId
    );
    
    await chrome.storage.local.set({
      activeSessions: data.activeSessions,
      sessionMetadata: {
        ...data.sessionMetadata,
        [sessionName]: {
          ...data.sessionMetadata[sessionName],
          lastModified: new Date().toISOString()
        }
      }
    });
    
    console.log('Update completed successfully');
  } catch (error) {
    console.error('Error updating session:', error);
  } finally {
    isUpdating = false;
  }
}

// Window removal listener
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    if (sessionName) {
      const updatedActiveSessions = { ...data.activeSessions };
      delete updatedActiveSessions[sessionName];

      await chrome.storage.local.set({ 
        activeSessions: updatedActiveSessions,
        sessionMetadata: data.sessionMetadata
      });
    }
  } catch (error) {
    console.error('Error handling window removal:', error);
  }
});

// Agregar listener para cambios de ventana activa
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  const data = await chrome.storage.local.get(['activeSessions']);
  const isActiveSession = Object.values(data.activeSessions || {}).includes(windowId);

  // Actualizar ícono según el estado de la ventana
  chrome.action.setIcon({
    path: isActiveSession ? {
      "16": "icon-active-16.png",
      "32": "icon-active-32.png",
      "48": "icon-active-48.png",
      "128": "icon-active-128.png"
    } : {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png"
    },
    windowId: windowId
  });
}); 