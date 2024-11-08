// Add listeners for tab events
chrome.tabs.onCreated.addListener((tab) => {
  updateSessionOnTabChange(tab.windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateSessionOnTabChange(tab.windowId);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  updateSessionOnTabChange(removeInfo.windowId);
});

// Listener for window removal
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const data = await chrome.storage.local.get(['activeSessions', 'sessions']);
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    if (sessionName) {
      // Obtenemos el último estado guardado de las pestañas
      const updatedSessions = { ...data.sessions };
      
      // Eliminamos la referencia de activeSessions
      const updatedActiveSessions = { ...data.activeSessions };
      delete updatedActiveSessions[sessionName];

      // Actualizamos storage manteniendo las URLs en sessions
      await chrome.storage.local.set({ 
        sessions: updatedSessions,
        activeSessions: updatedActiveSessions
      });
    }
  } catch (error) {
    console.error('Error handling window removal:', error);
  }
});

// Function to update session data when tabs change
async function updateSessionOnTabChange(windowId) {
  try {
    const data = await chrome.storage.local.get(['activeSessions', 'sessions']);
    const sessionName = Object.entries(data.activeSessions || {}).find(
      ([, id]) => id === windowId
    )?.[0];

    if (sessionName) {
      const tabs = await chrome.tabs.query({ windowId });
      if (tabs && tabs.length > 0) {
        const urls = tabs.map(tab => tab.url);
        
        // Update URLs in the session
        const updatedSessions = { ...data.sessions };
        updatedSessions[sessionName] = urls;
        
        await chrome.storage.local.set({ 
          sessions: updatedSessions,
          activeSessions: data.activeSessions
        });
      }
    }
  } catch (error) {
    console.error('Error updating session:', error);
  }
} 