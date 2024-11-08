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
  chrome.storage.local.get({ sessions: {}, activeSessions: {} }, (data) => {
    data.sessions[sessionName] = urls;
    data.activeSessions[sessionName] = currentWindow.id;
    
    // Update storage
    chrome.storage.local.set({ 
      sessions: data.sessions,
      activeSessions: data.activeSessions
    }, () => {
      updateSessionList();
      showCurrentSession();
      document.getElementById('saveControls').style.display = 'none';
      document.getElementById('sessionName').value = '';
      alert(`Sesión '${sessionName}' guardada!`);
    });
  });
});

// Update the session list
function updateSessionList() {
  chrome.storage.local.get(["sessions", "activeSessions"], async (data) => {
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
      
      const isSessionActive = data.activeSessions && 
                             data.activeSessions[name] && 
                             activeWindowIds.includes(data.activeSessions[name]);
      
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
      delete data.sessions[oldName];
      data.sessions[newName] = urls;
      
      // Actualizar activeSessions si es necesario
      if (data.activeSessions && data.activeSessions[oldName]) {
        const windowId = data.activeSessions[oldName];
        delete data.activeSessions[oldName];
        data.activeSessions[newName] = windowId;
      }
      
      chrome.storage.local.set({
        sessions: data.sessions,
        activeSessions: data.activeSessions
      }, () => {
        updateSessionList();
        showCurrentSession();
      });
    });
  }
}

function deleteSession(sessionName) {
  if (confirm(`¿Estás seguro de que quieres eliminar la sesión '${sessionName}'?`)) {
    chrome.storage.local.get(['sessions', 'activeSessions'], (data) => {
      delete data.sessions[sessionName];
      delete data.activeSessions[sessionName];
      
      chrome.storage.local.set({
        sessions: data.sessions,
        activeSessions: data.activeSessions
      }, () => {
        updateSessionList();
        showCurrentSession();
      });
    });
  }
}


// Función para abrir una sesión
async function openSession(sessionName, urls) {
  try {
    // Crear nueva ventana con la primera URL
    const newWindow = await chrome.windows.create({ url: urls[0] });
    
    // Abrir el resto de las pestañas en la nueva ventana
    for (let i = 1; i < urls.length; i++) {
      await chrome.tabs.create({
        windowId: newWindow.id,
        url: urls[i]
      });
    }

    // Guardar como sesión activa
    const data = await chrome.storage.local.get({ activeSessions: {} });
    data.activeSessions[sessionName] = newWindow.id;
    
    await chrome.storage.local.set({
      activeSessions: data.activeSessions
    });
    
    updateSessionList();
    showCurrentSession();
  } catch (error) {
    console.error('Error opening session:', error);
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

// Export sessions
document.getElementById('exportSessions').addEventListener('click', () => {
  chrome.storage.local.get(['sessions', 'activeSessions'], (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sessions-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Import sessions
document.getElementById('importSessions').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        chrome.storage.local.set(data, () => {
          updateSessionList();
          showCurrentSession();
          alert('Sesiones importadas correctamente');
        });
      } catch (error) {
        alert('Error al importar el archivo');
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

