# Hablo

Teclado de voz con IA para Windows. Pulsa un atajo, habla y el texto ya pulido se pega donde esté el cursor, en cualquier aplicación.

Hecho con Electron. No tiene servidores propios: el audio y el texto viajan directo de tu equipo al proveedor de IA que elijas, con tu propia API key.

**Versión actual:** 0.4.0 · **Autor:** safesoftwaresolution

## Qué hace

### Atajos principales

| Atajo | Acción |
|---|---|
| `Ctrl+Alt+D` | **Dictar.** Mantén pulsado y habla, o toca una vez para manos libres (otro toque termina). |
| `Ctrl+Alt+A` | **Preguntar o editar.** Con texto seleccionado lo edita por voz ("hazlo más corto", "tradúcelo"); sin selección responde tu pregunta. |
| `Ctrl+Alt+T` | **Traducir.** Hablas en tu idioma y escribe en el idioma de destino. |
| `Esc` | Cancela la grabación en curso. |

Los atajos se pueden cambiar desde **Ajustes → Atajos**.

### Funciones

- **Pulido con IA:** quita muletillas ("eh", "o sea", "um"), tartamudeos y repeticiones; si te corriges a mitad de frase ("mejor dicho…") deja solo la versión final; arregla puntuación y mayúsculas; entiende comandos de formato como "nueva línea" o "punto y aparte"; y convierte enumeraciones en listas.
- **Idiomas mezclados:** en modo automático detecta el idioma y admite varios en la misma frase.
- **Tono por aplicación:** formal en Outlook o Gmail, casual en Slack, WhatsApp, Discord o Telegram, literal en VS Code, Cursor y terminales. Las reglas son editables y se aplican si el nombre del programa o el título de la ventana contiene el texto.
- **Tonos disponibles:** auto, formal, casual, conciso y literal.
- **Plantillas por voz:** empieza a dictar diciendo el nombre de una plantilla y Hablo ordena lo que digas con esa estructura. Ejemplo: «*acta de reunión*, hoy estuvimos con Marta y Luis y acordamos…». Si falta un dato escribe `[pendiente]` en vez de inventarlo. Vienen cinco de fábrica (acta de reunión, respuesta a cliente, correo formal, lista de tareas, mensaje de seguimiento) y puedes crear o editar las tuyas.
- **Diccionario:** nombres, marcas y términos técnicos que deben escribirse exactamente así. Se envían como pista al transcriptor y al pulido.
- **Sobre ti:** una descripción corta de quién eres y cómo escribes para que el texto suene como tú.
- **Audios a texto:** en la pantalla **Audios** suelta o elige notas de voz, grabaciones o reuniones (mp3, m4a, wav, ogg, webm, flac, mp4) y Hablo las transcribe, con opción de pulir el texto con IA. Límite de 25 MB por archivo, el tope de OpenAI y Groq. Los resultados se guardan en el historial como "Audio" y no suman a las estadísticas de dictado.
- **Revisor de texto:** pega un texto (mínimo 30 palabras) y Hablo estima qué tan probable es que suene a IA, señala las señales concretas, sugiere mejoras y propone una versión más personal. Es una estimación orientativa, no una prueba: ningún detector es fiable al 100 % y no debe usarse para acusar a nadie.
- **Historial local:** dictados, ediciones, preguntas y traducciones, con búsqueda y filtro por tipo. Guarda hasta 500 entradas, muestra lo que dijiste originalmente junto al texto final y permite **exportar** o borrar todo.
- **Resumir notas:** desde el historial, resume una nota larga (mínimo 40 palabras) en idea general, puntos clave y tareas con responsable y fecha si se mencionaron.
- **Estadísticas:** palabras dictadas, palabras del día, palabras por minuto, actividad semanal y tiempo ahorrado frente a teclear a 45 ppm.
- **Modo susurro:** amplifica la voz baja para dictar sin molestar.
- **Extras:** prueba de micrófono con medidor, sonidos de inicio y fin, inicio automático con Windows y guía de bienvenida.

## Proveedores de IA

Funciona con cualquier API compatible con OpenAI (`/audio/transcriptions` y `/chat/completions`). Hay dos presets listos:

| Proveedor | Transcripción | Texto |
|---|---|---|
| OpenAI | `gpt-4o-mini-transcribe` | `gpt-4o-mini` |
| Groq | `whisper-large-v3-turbo` | `llama-3.1-8b-instant` |

Puedes cambiar la URL base y los modelos a mano para usar otro servicio compatible. En **Ajustes** hay un botón para probar la conexión.

## Instalación y uso

Requisitos: Windows 10/11 y Node.js.

```
npm install
npm start
```

1. Abre **Ajustes**, elige proveedor y guarda tu API key.
2. Haz clic en cualquier campo de texto de cualquier app.
3. Usa `Ctrl+Alt+D` y habla.

También puedes probarlo en el recuadro "Pruébalo aquí" de la pantalla de Inicio.

### Generar el instalador

```
npm run dist
```

Crea el instalador NSIS en `dist/`.

## Privacidad

- Hablo no tiene servidores ni telemetría: el audio y el texto solo se envían al proveedor que configuraste.
- La API key se guarda cifrada con el almacenamiento seguro del sistema (`safeStorage` de Electron). Si el cifrado no está disponible, queda codificada pero no cifrada.
- El historial, los ajustes y las estadísticas viven en la carpeta de datos de la app en tu equipo (`%APPDATA%\hablo`) y puedes borrarlos desde la app.

## Estructura del proyecto

```
main.js          Proceso principal: ventanas, atajos, flujo de dictado
preload.js       Puente seguro entre el proceso principal y la interfaz
src/ai.js        Transcripción (voz y archivos), pulido, edición, preguntas, revisor y resumen
src/store.js     Ajustes, API key, historial y estadísticas
src/keys.js      Atajos globales y detección de mantener/tocar
src/winhelper.js Contexto de la ventana activa e inserción del texto
renderer/        Interfaz (ventana principal, overlay de grabación, respuestas)
build/           Configuración extra del instalador
```

## Licencia

Copyright © 2026 safesoftwaresolution. Todos los derechos reservados.
