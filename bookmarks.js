// Inicializar carpeta raíz de marcadores
async function initializeBookmarkFolder() {
  const nodes = await chrome.bookmarks.search({title: 'TabSessions'});
  if (nodes.length === 0) {
    return chrome.bookmarks.create({
      title: 'TabSessions',
      parentId: '1'  // Barra de marcadores
    });
  }
  return nodes[0];
}

// Crear o actualizar marcadores de una sesión
async function updateSessionBookmarks(sessionName, tabs, existingFolderId = null) {
  console.log('Updating bookmarks for:', sessionName, 'Folder ID:', existingFolderId);
  const root = await initializeBookmarkFolder();
  
  // Si existe la carpeta, eliminar su contenido
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