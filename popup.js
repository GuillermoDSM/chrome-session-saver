// Initialize popup when opened
document.addEventListener('DOMContentLoaded', () => {
  updateSessionList();
  showCurrentSession();
  checkCurrentWindow();
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
      checkCurrentWindow();
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
      nameSpan.textContent = name;
      
      const editButton = document.createElement('i');
      editButton.dataset.lucide = 'edit';
      editButton.className = 'edit-button';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        editSessionName(name, data.sessions[name]);
      });
      
      listItem.appendChild(nameSpan);
      listItem.appendChild(editButton);
      
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
    
    // Inicializar los iconos de Lucide
    lucide.createIcons();
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
    checkCurrentWindow();
  });
}

// Listener para cuando se cierra una ventana
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get("activeSession", (data) => {
    if (data.activeSession && data.activeSession.windowId === windowId) {
      chrome.storage.local.remove("activeSession", () => {
        updateSessionList();
        showCurrentSession();
        checkCurrentWindow();
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
