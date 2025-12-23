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
    alert("Please enter a session name");
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
    try {
      const data = await chrome.storage.local.get({ 
        activeSessions: {}, 
        sessionMetadata: {} 
      });
      data.activeSessions[sessionName] = currentWindow.id;
      data.sessionMetadata[sessionName] = metadata;
      
      await chrome.storage.local.set(data);
      updateSessionList();
      showCurrentSession();
      document.getElementById('saveControls').style.display = 'none';
      document.getElementById('sessionName').value = '';
      closePopup();
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error saving session: ' + error.message);
    }
  } catch (error) {
    console.error('Error saving session:', error);
    alert('Error saving session');
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
        editSessionName(sessionName, listItem);
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

async function editSessionName(oldName, listItem) {
  const nameSpan = listItem.querySelector('.session-name');
  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.className = 'edit-input editing';
  editInput.value = oldName;
  
  // Insert input before the name span
  nameSpan.parentNode.insertBefore(editInput, nameSpan);
  nameSpan.classList.add('editing');
  
  // Focus and select the input text
  editInput.focus();
  editInput.select();

  let isEditing = true; // Flag para controlar el estado de edición

  const saveEdit = async () => {
    if (!isEditing) return; // Evitar múltiples ejecuciones
    isEditing = false;

    const newName = editInput.value.trim();
    if (newName && newName !== oldName) {
      try {
        const data = await chrome.storage.local.get(['activeSessions', 'sessionMetadata']);
        
        // Verificar que el nuevo nombre no exista
        if (data.sessionMetadata[newName]) {
          alert('A session with this name already exists');
          editInput.focus();
          editInput.select();
          isEditing = true; // Permitir seguir editando
          return;
        }
        
        // Obtener metadata de la sesión actual
        const metadata = data.sessionMetadata[oldName];
        
        // Actualizar nombre en marcadores
        try {
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
        } catch (error) {
          console.error('Error renaming session:', error);
          alert('Error renaming session: ' + error.message);
          return;
        }
        
        updateSessionList();
      } catch (error) {
        console.error('Error renaming session:', error);
        alert('Error renaming session');
      }
    }
    // Limpiar el input solo si no hubo error o si no hay cambios
    editInput.remove();
    nameSpan.classList.remove('editing');
  };

  // Handle Enter key and blur events
  editInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    }
  });

  editInput.addEventListener('blur', () => {
    saveEdit();
  });
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
      alert('Error deleting session: ' + error.message);
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
    try {
      const data = await chrome.storage.local.get(['activeSessions']);
      const activeSessions = data.activeSessions || {};
      activeSessions[sessionName] = newWindow.id;
      
      await chrome.storage.local.set({ activeSessions });
    } catch (error) {
      console.error('Error setting active session:', error);
      alert('Error opening session: ' + error.message);
    }
    
    updateSessionList();
    showCurrentSession();
    closePopup();
  } catch (error) {
    console.error('Error opening session:', error);
    alert('Error opening session');
  }
}

// Show current session if we're in one
async function showCurrentSession() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const data = await chrome.storage.local.get(['activeSessions', 'sessions']);
    
    const sessionIndicator = document.getElementById('currentSession');
    const saveControls = document.getElementById('saveControls');
    
    // Encontrar si la ventana actual es una sesión activa
    const activeSessionName = Object.entries(data.activeSessions || {}).find(
      ([name, windowId]) => windowId === currentWindow.id
    )?.[0];
    
    if (activeSessionName) {
      sessionIndicator.textContent = `Current session: ${activeSessionName}`;
      sessionIndicator.style.display = 'block';
      saveControls.style.display = 'none';
      // Cambiar a ícono activo
      await chrome.action.setIcon({
        path: {
          "16": "icon-active-16.png",
          "32": "icon-active-32.png",
          "48": "icon-active-48.png",
          "128": "icon-active-128.png"
        }
      });
    } else {
      sessionIndicator.style.display = 'none';
      saveControls.style.display = 'flex';
      // Restaurar ícono normal
      await chrome.action.setIcon({
        path: {
          "16": "icon-16.png",
          "32": "icon-32.png",
          "48": "icon-48.png",
          "128": "icon-128.png"
        }
      });
    }
  } catch (error) {
    console.error('Error showing current session:', error);
  }
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
    alert('Error exporting sessions');
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
        // Verificar si la sesión existe y comparar fechas
        if (sessionMetadata[sessionName]) {
          const existingDate = new Date(sessionMetadata[sessionName].lastModified);
          const importDate = new Date(sessionData.metadata.lastModified);
          
          // Si la sesión existente es más reciente, omitir importación
          if (existingDate >= importDate) {
            console.log(`Omitiendo sesión ${sessionName}: versión local más reciente`);
            continue;
          }
          
          // Actualizar sesión existente con datos más recientes
          await updateSessionBookmarks(
            sessionName,
            sessionData.urls.map(url => ({ url, title: url })),
            sessionMetadata[sessionName].bookmarkFolderId
          );
          
          sessionMetadata[sessionName] = {
            ...sessionMetadata[sessionName],
            lastModified: sessionData.metadata.lastModified
          };
          
        } else {
          // Crear nueva sesión
          const folder = await chrome.bookmarks.create({
            parentId: root.id,
            title: sessionName
          });
          
          // Crear marcadores para cada URL
          if (Array.isArray(sessionData.urls)) {
            for (const url of sessionData.urls) {
              try {
                if (url && !url.startsWith('chrome://')) {
                  await chrome.bookmarks.create({
                    parentId: folder.id,
                    url: url,
                    title: url
                  });
                }
              } catch (err) {
                console.warn('Error al crear marcador:', url, err);
                continue;
              }
            }
          }
          
          // Guardar metadata
          sessionMetadata[sessionName] = {
            bookmarkFolderId: folder.id,
            created: sessionData.metadata.created,
            lastModified: sessionData.metadata.lastModified
          };
        }
      }
      
      // Actualizar storage
      await chrome.storage.local.set({ sessionMetadata });
      
      updateSessionList();
      alert('Sessions imported successfully');
    } catch (error) {
      console.error('Error importing sessions:', error);
      alert('Error importing sessions: ' + error.message);
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

// Listener para mensajes del background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'windowFocusChanged') {
    showCurrentSession();
  }
});

