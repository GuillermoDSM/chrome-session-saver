// Test para verificar que las funciones estén disponibles
console.log('Testing bookmark functions...');

// Test functions availability
if (typeof initializeBookmarkFolder === 'function') {
  console.log('✅ initializeBookmarkFolder available');
} else {
  console.log('❌ initializeBookmarkFolder NOT available');
}

if (typeof updateSessionBookmarks === 'function') {
  console.log('✅ updateSessionBookmarks available');
} else {
  console.log('❌ updateSessionBookmarks NOT available');
}

if (typeof deleteSessionBookmarks === 'function') {
  console.log('✅ deleteSessionBookmarks available');
} else {
  console.log('❌ deleteSessionBookmarks NOT available');
}

if (typeof getSessionUrls === 'function') {
  console.log('✅ getSessionUrls available');
} else {
  console.log('❌ getSessionUrls NOT available');
}