import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@phosphor-icons/web/regular'
import './design-system/styles.css'
// Imported for its module-level side effect (stamping <html data-layout>) and
// deliberately before App, so the attribute is set before the first render
// reads it via useIsDesktop — otherwise desktop would paint the phone layout
// for one frame.
import './lib/layoutMode.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so Android Chrome offers the real "Install app"
// (WebAPK) path, not just an "Add to home screen" shortcut, and so the app
// shell works offline (see public/sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app still works uninstalled if registration fails.
    })
  })
}

// Best-effort runtime lock backing manifest.json's "orientation": "portrait-primary"
// (which Chrome only honors once the PWA is installed/standalone). The Screen
// Orientation API additionally requires a fullscreen or standalone context in
// most browsers and throws otherwise (e.g. an ordinary browser tab, iOS
// Safari, which doesn't implement it at all) — never fatal to the app either way.
if (screen.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {})
}
