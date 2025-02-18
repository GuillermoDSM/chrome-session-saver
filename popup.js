function closePopup() {
  window.close();
}

// Initialize popup when opened
document.addEventListener('DOMContentLoaded', async () => {
  updateSessionList();
  showCurrentSession();
  
  // Obtener el título de la primera pestaña de la ventana actual
  const currentWindow = await chrome.windows.getCurrent();
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
  if (tabs.length > 0) {
    const sessionNameInput = document.getElementById('sessionName');
    sessionNameInput.value = tabs[0].title;
    sessionNameInput.select(); // Seleccionar el texto para fácil edición
  }
});

// Agregar event listener para el enter en el input
document.getElementById('sessionName').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveSession').click();
  }
});

// Save current tabs in the window as a session
document.getElementById('saveSession').addEventListener('click', async () => {
  let sessionName = document.getElementById('sessionName').value;
  if (!sessionName) {
    alert("Por favor ingresa un nombre para la sesión");
    return;
  }
  
  try {
    // Get current window and its tabs
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
    
    // Guardar en marcadores y obtener el ID de la carpeta
    const bookmarkFolderId = await updateSessionBookmarks(sessionName, tabs);
    
    // Guardar metadata en storage local
    const metadata = {
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      bookmarkFolderId: bookmarkFolderId
    };
    
    // Actualizar storage local
    chrome.storage.local.get({ 
      activeSessions: {}, 
      sessionMetadata: {} 
    }, (data) => {
      data.activeSessions[sessionName] = currentWindow.id;
      data.sessionMetadata[sessionName] = metadata;
      
      chrome.storage.local.set(data, () => {
        updateSessionList();
        showCurrentSession();
        document.getElementById('saveControls').style.display = 'none';
        document.getElementById('sessionName').value = '';
        closePopup();
      });
    });
  } catch (error) {
    console.error('Error saving session:', error);
    alert('Error al guardar la sesión');
  }
});

// Update the session list
async function updateSessionList() {
  try {
    // Obtener datos de storage y marcadores
    const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
    const root = await initializeBookmarkFolder();
    const bookmarkFolders = await chrome.bookmarks.getChildren(root.id);
    
    // Crear mapa de carpetas de marcadores existentes
    const bookmarkMap = new Map(
      bookmarkFolders.map(folder => [folder.title, folder])
    );
    
    // Crear mapa de metadata existente
    const metadataMap = new Map(
      Object.entries(data.sessionMetadata || {})
    );
    
    const cleanedMetadata = {};
    const cleanedActiveSessions = { ...data.activeSessions };
    
    // Procesar carpetas de marcadores
    for (const folder of bookmarkFolders) {
      if (!metadataMap.has(folder.title)) {
        // Crear metadata para carpetas que existen en marcadores pero no en storage
        cleanedMetadata[folder.title] = {
          bookmarkFolderId: folder.id,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
      } else {
        // Mantener metadata existente
        cleanedMetadata[folder.title] = {
          ...metadataMap.get(folder.title),
          bookmarkFolderId: folder.id
        };
      }
    }
    
    // Limpiar activeSessions de sesiones que ya no existen
    for (const sessionName in cleanedActiveSessions) {
      if (!bookmarkMap.has(sessionName)) {
        delete cleanedActiveSessions[sessionName];
      }
    }
    
    // Actualizar storage si hay cambios
    if (JSON.stringify(data.sessionMetadata) !== JSON.stringify(cleanedMetadata)) {
      await chrome.storage.local.set({
        sessionMetadata: cleanedMetadata,
        activeSessions: cleanedActiveSessions
      });
    }
    
    // Actualizar UI
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';
    
    if (Object.keys(cleanedMetadata).length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No hay sesiones guardadas';
      message.style.color = '#666';
      sessionList.appendChild(message);
      return;
    }
    
    const windows = await chrome.windows.getAll();
    const activeWindowIds = windows.map(w => w.id);
    
    for (let sessionName in cleanedMetadata) {
      const listItem = document.createElement('li');
      listItem.className = 'session-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'session-name';
      nameSpan.textContent = sessionName;
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';
      
      const editButton = document.createElement('div');
      editButton.className = 'edit-button';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        editSessionName(sessionName);
      });
      
      const deleteButton = document.createElement('div');
      deleteButton.className = 'delete-button';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(sessionName);
      });
      
      buttonContainer.appendChild(editButton);
      buttonContainer.appendChild(deleteButton);
      listItem.appendChild(nameSpan);
      listItem.appendChild(buttonContainer);
      
      const isSessionActive = data.activeSessions && 
                            data.activeSessions[sessionName] && 
                            activeWindowIds.includes(data.activeSessions[sessionName]);
      
      if (isSessionActive) {
        listItem.style.color = '#999';
        listItem.style.fontStyle = 'italic';
      } else {
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => openSession(sessionName));
      }
      
      sessionList.appendChild(listItem);
    }
  } catch (error) {
    console.error('Error updating session list:', error);
  }
}

async function editSessionName(oldName) {
  const newName = prompt(`Editar nombre de la sesión '${oldName}':`);
  if (newName && newName !== oldName) {
    try {
      const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
      
      // Verificar que el nuevo nombre no exista
      if (data.sessionMetadata[newName]) {
        throw new Error('Ya existe una sesión con ese nombre');
      }
      
      // Obtener metadata de la sesión actual
      const metadata = data.sessionMetadata[oldName];
      
      // Actualizar nombre en marcadores
      await chrome.bookmarks.update(metadata.bookmarkFolderId, { title: newName });
      
      // Actualizar storage local
      data.sessionMetadata[newName] = {
        ...metadata,
        lastModified: new Date().toISOString()
      };
      delete data.sessionMetadata[oldName];
      
      // Actualizar activeSessions si es necesario
      if (data.activeSessions[oldName]) {
        data.activeSessions[newName] = data.activeSessions[oldName];
        delete data.activeSessions[oldName];
      }
      
      await chrome.storage.local.set({
        activeSessions: data.activeSessions,
        sessionMetadata: data.sessionMetadata
      });
      
      updateSessionList();
    } catch (error) {
      console.error('Error renaming session:', error);
      alert(error.message || 'Error al renombrar la sesión');
    }
  }
}

async function deleteSession(sessionName) {
  if (confirm(`¿Estás seguro de que quieres eliminar la sesión '${sessionName}'?`)) {
    try {
      // Obtener datos actuales
      const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
      
      // Eliminar carpeta de marcadores si existe
      if (data.sessionMetadata[sessionName]) {
        await deleteSessionBookmarks(data.sessionMetadata[sessionName].bookmarkFolderId);
      }
      
      // Eliminar metadata y referencia activa
      delete data.sessionMetadata[sessionName];
      delete data.activeSessions[sessionName];
      
      // Actualizar storage
      await chrome.storage.local.set({
        activeSessions: data.activeSessions,
        sessionMetadata: data.sessionMetadata
      });
      
      updateSessionList();
      showCurrentSession();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error al eliminar la sesión');
    }
  }
}

async function openSession(sessionName) {
  try {
    const data = await chrome.storage.local.get(['sessionMetadata']);
    const metadata = data.sessionMetadata[sessionName];
    
    if (!metadata) {
      throw new Error('Session metadata not found');
    }
    
    // Obtener URLs de los marcadores
    const urls = await getSessionUrls(metadata.bookmarkFolderId);
    
    if (!urls || urls.length === 0) {
      throw new Error('No URLs found in session');
    }
    
    // Crear nueva ventana con la primera URL
    const newWindow = await chrome.windows.create({ url: urls[0] });
    
    // Abrir el resto de las pestañas
    for (let i = 1; i < urls.length; i++) {
      await chrome.tabs.create({
        windowId: newWindow.id,
        url: urls[i]
      });
    }
    
    // Actualizar sesión activa
    const activeSessions = (await chrome.storage.local.get(['activeSessions'])).activeSessions || {};
    activeSessions[sessionName] = newWindow.id;
    
    await chrome.storage.local.set({ activeSessions });
    
    updateSessionList();
    showCurrentSession();
    closePopup();
  } catch (error) {
    console.error('Error opening session:', error);
    alert('Error al abrir la sesión');
  }
}

// Show current session if we're in one
async function showCurrentSession() {
  const currentWindow = await chrome.windows.getCurrent();
  
  chrome.storage.local.get(['activeSessions', 'sessions'], (data) => {
    const sessionIndicator = document.getElementById('currentSession');
    const saveControls = document.getElementById('saveControls');
    
    // Encontrar si la ventana actual es una sesión activa
    const activeSessionName = Object.entries(data.activeSessions || {}).find(
      ([name, windowId]) => windowId === currentWindow.id
    )?.[0];
    
    if (activeSessionName) {
      sessionIndicator.textContent = `Sesión actual: ${activeSessionName}`;
      sessionIndicator.style.display = 'block';
      saveControls.style.display = 'none';
    } else {
      sessionIndicator.style.display = 'none';
      saveControls.style.display = 'flex';
    }
  });
}

// Toggle settings menu
document.getElementById('settingsButton').addEventListener('click', () => {
  const menu = document.getElementById('settingsMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});

// Exportar sesiones
document.getElementById('exportSessions').addEventListener('click', async () => {
  try {
    const data = await chrome.storage.local.get(['sessionMetadata']);
    const exportData = { sessions: {} };
    
    // Recopilar datos de cada sesión
    for (const [sessionName, metadata] of Object.entries(data.sessionMetadata)) {
      const urls = await getSessionUrls(metadata.bookmarkFolderId);
      exportData.sessions[sessionName] = {
        urls,
        metadata: {
          created: metadata.created,
          lastModified: metadata.lastModified
        }
      };
    }
    
    // Crear y descargar el archivo
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-sessions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting sessions:', error);
    alert('Error al exportar las sesiones');
  }
});

// Importar sesiones
document.getElementById('importSessions').addEventListener('click', async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.sessions) {
        throw new Error('Formato de archivo inválido');
      }
      
      // Obtener carpeta raíz de TabSessions
      const root = await initializeBookmarkFolder();
      
      // Obtener datos actuales
      const data = await chrome.storage.local.get(['sessionMetadata']);
      const sessionMetadata = { ...data.sessionMetadata };
      
      // Importar cada sesión
      for (const [sessionName, sessionData] of Object.entries(importData.sessions)) {
        // Verificar si el nombre ya existe
        let finalName = sessionName;
        let counter = 1;
        while (sessionMetadata[finalName]) {
          finalName = `${sessionName} (${counter})`;
          counter++;
        }
        
        // Crear carpeta de marcadores para la sesión
        const folder = await chrome.bookmarks.create({
          parentId: root.id,
          title: finalName
        });
        
        // Crear marcadores para cada URL
        for (const url of sessionData.urls) {
          await chrome.bookmarks.create({
            parentId: folder.id,
            url: url,
            title: url
          });
        }
        
        // Guardar metadata
        sessionMetadata[finalName] = {
          bookmarkFolderId: folder.id,
          created: sessionData.metadata.created || new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
      }
      
      // Actualizar storage
      await chrome.storage.local.set({ sessionMetadata });
      
      updateSessionList();
      alert('Sesiones importadas correctamente');
    } catch (error) {
      console.error('Error importing sessions:', error);
      alert('Error al importar las sesiones');
    }
  };
  
  input.click();
});

document.addEventListener('click', (e) => {
  // Si el clic fue en el popup mismo, no hacemos nada
  if (e.target.closest('#settingsMenu') || 
      e.target.closest('#saveControls') || 
      e.target.closest('.session-item') ||
      e.target.closest('#settingsButton')) {
    return;
  }
  closePopup();
});

