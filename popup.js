// Initialize popup when opened
document.addEventListener('DOMContentLoaded', () => {
  updateSessionList();
  showCurrentSession();
});

// Save current tabs in the window as a session
document.getElementById('saveSession').addEventListener('click', async () => {
  let sessionName = document.getElementById('sessionName').value;
  if (!sessionName) {
    alert("Por favor ingresa un nombre para la sesión");
    return;
  }
  
  // Get current window and its tabs
  const currentWindow = await chrome.windows.getCurrent();
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
  const urls = tabs.map(tab => tab.url);

  // Save session in Chrome storage
  chrome.storage.local.get({ sessions: {} }, (data) => {
    data.sessions[sessionName] = urls;
    
    // Save active session info
    const activeSession = {
      name: sessionName,
      windowId: currentWindow.id
    };
    
    // Update storage
    chrome.storage.local.set({ 
      sessions: data.sessions,
      activeSession: activeSession
    }, () => {
      updateSessionList();
      showCurrentSession();
      alert(`Sesión '${sessionName}' guardada!`);
    });
  });
});

// Update the session list
function updateSessionList() {
  chrome.storage.local.get(["sessions", "activeSession"], async (data) => {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';
    
    if (!data.sessions || Object.keys(data.sessions).length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No hay sesiones guardadas';
      message.style.color = '#666';
      sessionList.appendChild(message);
      return;
    }
    
    const windows = await chrome.windows.getAll();
    const activeWindowIds = windows.map(w => w.id);
    
    for (let name in data.sessions) {
      const listItem = document.createElement('li');
      listItem.className = 'session-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'session-name';
      nameSpan.textContent = name;
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';
      
      const editButton = document.createElement('div');
      editButton.className = 'edit-button';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        editSessionName(name, data.sessions[name]);
      });
      
      const deleteButton = document.createElement('div');
      deleteButton.className = 'delete-button';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(name);
      });
      
      buttonContainer.appendChild(editButton);
      buttonContainer.appendChild(deleteButton);
      listItem.appendChild(nameSpan);
      listItem.appendChild(buttonContainer);
      
      const isSessionActive = data.activeSession && 
                            data.activeSession.name === name && 
                            activeWindowIds.includes(data.activeSession.windowId);
      
      if (isSessionActive) {
        listItem.style.color = '#999';
        listItem.style.fontStyle = 'italic';
      } else {
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => openSession(name, data.sessions[name]));
      }
      
      sessionList.appendChild(listItem);
    }
  });
}

function editSessionName(oldName, urls) {
  const newName = prompt('Ingrese el nuevo nombre para la sesión:', oldName);
  if (newName && newName !== oldName) {
    chrome.storage.local.get({ sessions: {} }, (data) => {
      // Eliminar la sesión antigua y crear una nueva con el nuevo nombre
      delete data.sessions[oldName];
      data.sessions[newName] = urls;
      
      // Actualizar activeSession si es necesario
      chrome.storage.local.get("activeSession", (activeData) => {
        const updates = { sessions: data.sessions };
        if (activeData.activeSession && activeData.activeSession.name === oldName) {
          updates.activeSession = {
            ...activeData.activeSession,
            name: newName
          };
        }
        
        chrome.storage.local.set(updates, () => {
          updateSessionList();
          showCurrentSession();
        });
      });
    });
  }
}

function deleteSession(sessionName) {
  if (confirm(`¿Estás seguro de que quieres eliminar la sesión '${sessionName}'?`)) {
    chrome.storage.local.get(['sessions', 'activeSession'], (data) => {
      delete data.sessions[sessionName];
      
      const updates = { sessions: data.sessions };
      
      // Si la sesión activa es la que estamos eliminando, también la removemos
      if (data.activeSession && data.activeSession.name === sessionName) {
        chrome.storage.local.remove('activeSession');
      }
      
      chrome.storage.local.set(updates, () => {
        updateSessionList();
        showCurrentSession();
      });
    });
  }
}


// Función para abrir una sesión
async function openSession(sessionName, urls) {
  const newWindow = await chrome.windows.create({ url: urls[0] });
  
  // Abrir el resto de las pestañas en la nueva ventana
  for (let i = 1; i < urls.length; i++) {
    chrome.tabs.create({
      windowId: newWindow.id,
      url: urls[i]
    });
  }

  // Guardar como sesión activa
  chrome.storage.local.set({
    activeSession: {
      name: sessionName,
      windowId: newWindow.id
    }
  }, () => {
    updateSessionList();
    showCurrentSession();
  });
}

// Listener para cuando se cierra una ventana
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get("activeSession", (data) => {
    if (data.activeSession && data.activeSession.windowId === windowId) {
      chrome.storage.local.remove("activeSession", () => {
        updateSessionList();
        showCurrentSession();
      });
    }
  });
});

// Show current session if we're in one
async function showCurrentSession() {
  const currentWindow = await chrome.windows.getCurrent();
  
  chrome.storage.local.get("activeSession", (data) => {
    const sessionIndicator = document.getElementById('currentSession');
    if (data.activeSession && data.activeSession.windowId === currentWindow.id) {
      sessionIndicator.textContent = `Sesión actual: ${data.activeSession.name}`;
      sessionIndicator.style.display = 'block';
    } else {
      sessionIndicator.style.display = 'none';
    }
  });
}

