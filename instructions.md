# Project Planning

## 1. General Description
- estamos programando un plugin de chrome que permite guardar las ventanas con todas las pestañas abiertas.
- Una ventana es el conjunto de todas las pestañas abiertas dentro de ella.
- cuando cierras una ventana guardada luego puedes recuperarla haciendo click en ella en la lista de ventanas guardadas.

## 2. Main Features
- al hacer click en el icono del plugin en una ventana no guardada muestra en la lista una caja para ingresar el nombre de la ventana y un boton con icono de guardar.
- Si una ventana se guarda entonces debe mostrarse en la lista sin ningun link
- cuando una ventana guardada está abierta se guardan las pestañas que se cierran y se abren.
- al hacer un click en el icono del addon, se actualizan todas las ventanas guardadas y se muestran en una lista. si aun no hay ventanas guardadas, se muestra un mensaje indicando que no hay ventanas guardadas.


## 4. Project Structure

📦 Session Saver (Chrome Extension)
├── 📄 manifest.json        # Archivo de configuración de la extensión
├── 📄 popup.html          
├── 📄 popup.js          
└── 📄 instructions.md    # Documentación y planificación del proyecto
