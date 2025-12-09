// Test simple para verificar sintaxis
console.log('Testing background.js syntax...');

// Simular chrome APIs para el test
global.chrome = {
  bookmarks: {
    search: async () => [],
    getTree: async () => [{children: [{id: '1'}]}],
    create: async () => ({id: 'test'}),
    getChildren: async () => [],
    remove: async () => {},
    removeTree: async () => {},
    update: async () => ({})
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    }
  }
};

// Cargar el archivo
require('./background.js');

console.log('✅ Background.js loaded successfully');