// Funciones de bookmarks centralizadas para el service worker

// Inicializar carpeta raíz de marcadores
async function initializeBookmarkFolder() {
  const nodes = await chrome.bookmarks.search({title: 'TabSessions'});
  if (nodes.length === 0) {
    // Buscar dinámicamente la barra de marcadores
    const tree = await chrome.bookmarks.getTree();
    const bookmarksBar = tree[0].children.find(node => node.id === '1') || tree[0].children[0];
    
    return chrome.bookmarks.create({
      title: 'TabSessions',
      parentId: bookmarksBar.id
    });
  }
  return nodes[0];
}

// Crear o actualizar marcadores de una sesión
async function updateSessionBookmarks(sessionName, tabs, existingFolderId = null) {
  console.log('🔖 Updating bookmarks for:', sessionName, 'Folder ID:', existingFolderId);
  
  try {
    const root = await initializeBookmarkFolder();
    console.log('📁 Root folder ID:', root.id);
    
    if (existingFolderId) {
      console.log('📂 Existing folder found, updating content');
      const children = await chrome.bookmarks.getChildren(existingFolderId);
      console.log('🗑️ Removing', children.length, 'existing bookmarks');
      for (const child of children) {
        await chrome.bookmarks.remove(child.id);
      }
      
      await chrome.bookmarks.update(existingFolderId, { title: sessionName });
      console.log('✏️ Updated folder title to:', sessionName);
    } else {
      console.log('➕ Creating new folder for session');
      const folder = await chrome.bookmarks.create({
        parentId: root.id,
        title: sessionName
      });
      existingFolderId = folder.id;
      console.log('📁 Created new folder with ID:', existingFolderId);
    }

    console.log('🔗 Creating bookmarks for', tabs.length, 'tabs');
    for (const tab of tabs) {
      console.log('📌 Creating bookmark for:', tab.url);
      await chrome.bookmarks.create({
        parentId: existingFolderId,
        title: tab.title || tab.url,
        url: tab.url
      });
    }

    console.log('✅ Bookmarks update completed for session:', sessionName);
    return existingFolderId;
  } catch (error) {
    console.error('💥 Error in updateSessionBookmarks:', error);
    console.error('💥 Error stack:', error.stack);
    throw error;
  }
}

// Eliminar carpeta de sesión
async function deleteSessionBookmarks(folderId) {
  if (folderId) {
    await chrome.bookmarks.removeTree(folderId);
  }
}

// Obtener URLs de una sesión guardada
async function getSessionUrls(folderId) {
  const bookmarks = await chrome.bookmarks.getChildren(folderId);
  return bookmarks.map(b => b.url);
}

// Variable global para el debounce
let updateTimeout = null;
let isUpdating = false;  // Semaforo para evitar actualizaciones simultaneas

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

// Funcion para programar actualizaciones
function scheduleUpdate(windowId) {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  updateTimeout = setTimeout(() => {
    updateSessionOnTabChange(windowId);
  }, 3000); // Aumentamos a 3 segundos para reducir spam
}

// Funcion mejorada para actualizar marcadores
async function updateSessionOnTabChange(windowId) {
  if (isUpdating) {
    console.log('⏸️ Update already in progress, skipping for window:', windowId);
    return;
  }

  try {
    isUpdating = true;
    console.log('🔄 Starting update for window:', windowId);
    
    const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
    console.log('📊 Active sessions:', data.activeSessions);
    console.log('📋 Session metadata:', data.sessionMetadata);
    
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    console.log('🎯 Found session name:', sessionName, 'for window:', windowId);

    if (!sessionName || !data.sessionMetadata[sessionName]) {
      console.log('❌ No active session found for window:', windowId);
      return;
    }

    const tabs = await chrome.tabs.query({ windowId });
    console.log('📑 Tabs found:', tabs.length, 'for window:', windowId);
    
    if (!tabs || tabs.length === 0) {
      console.log('❌ No tabs found in window:', windowId);
      return;
    }
    
    console.log('🔖 Calling updateSessionBookmarks with folderId:', data.sessionMetadata[sessionName].bookmarkFolderId);
    
    await updateSessionBookmarks(
      sessionName, 
      tabs, 
      data.sessionMetadata[sessionName].bookmarkFolderId
    );
    
    console.log('💾 Updating storage with lastModified...');
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
    
    console.log('✅ Update completed successfully for session:', sessionName);
  } catch (error) {
    console.error('💥 Error updating session:', error);
    console.error('💥 Error stack:', error.stack);
  } finally {
    isUpdating = false;
    console.log('🔓 Update lock released for window:', windowId);
  }
}

// Funcion para actualizar el icono segun el estado de la ventana
async function updateIcon(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  const data = await chrome.storage.local.get(['activeSessions']);
  const isActiveSession = Object.values(data.activeSessions || {}).includes(windowId);

  try {
    // En Manifest V3, setIcon no acepta windowId
    // Se actualiza el icono global basado en la ventana activa actual
    await chrome.action.setIcon({
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
      }
    });
  } catch (error) {
    console.error('Error updating icon:', error);
  }
}

// Listener para cambios de ventana activa
chrome.windows.onFocusChanged.addListener(updateIcon);

// Listener para cuando se cierra una ventana
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const data = await chrome.storage.local.get(['activeSessions']);
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    if (sessionName) {
      const updatedActiveSessions = { ...data.activeSessions };
      delete updatedActiveSessions[sessionName];
      try {
        await chrome.storage.local.set({ activeSessions: updatedActiveSessions });
      } catch (error) {
        console.error('Error handling window removal:', error);
      }
    }
  } catch (error) {
    console.error('Error handling window removal:', error);
  }
});