# Hablo

Teclado de voz con IA para Windows (Electron). Pulsa un atajo, habla y el texto pulido se pega donde esté el cursor.

- `Ctrl+Alt+D`: dictar. Mantén pulsado y habla, o toca una vez para manos libres (otro toque termina). `Esc` cancela
- `Ctrl+Alt+A`: con texto seleccionado lo edita por voz; sin selección responde la pregunta
- `Ctrl+Alt+T`: dicta en tu idioma y escribe traducido
- Diccionario, tono por app, traducción, modo susurro, historial local

## Uso
```
npm install
npm start
```
En Ajustes elige proveedor (OpenAI o Groq u otro compatible) y guarda tu API key.

## Instalador
`npm run dist` genera el instalador en `dist/`.
