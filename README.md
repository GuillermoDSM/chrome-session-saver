# Session Saver - Chrome Extension

Una extensión de Chrome que permite guardar y restaurar sesiones de navegación completas.

## Características

- Guarda todas las pestañas abiertas en una ventana como una sesión
- Restaura sesiones guardadas con un solo clic
- Las sesiones se actualizan automáticamente al agregar o cerrar pestañas
- Exporta e importa sesiones guardadas
- Interfaz minimalista y fácil de usar

## Instalación

1. Clona este repositorio o descarga los archivos
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa el "Modo desarrollador"
4. Haz clic en "Cargar descomprimida" y selecciona la carpeta del proyecto

## Uso

1. Haz clic en el icono de la extensión
2. Para guardar una sesión:
   - Ingresa un nombre para la sesión
   - Haz clic en el icono de guardar
3. Para restaurar una sesión:
   - Haz clic en el nombre de la sesión en la lista

## Estructura del Proyecto

- `manifest.json`: Configuración de la extensión
- `popup.html`: Interfaz de usuario
- `popup.js`: Lógica de la interfaz
- `background.js`: Service worker para eventos en segundo plano
