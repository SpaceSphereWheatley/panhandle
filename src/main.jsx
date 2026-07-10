import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so Android Chrome offers the real "Install app"
// (WebAPK) path, not just an "Add to home screen" shortcut. The SW itself is a
// no-cache network passthrough (see public/sw.js); registering it is enough to
// satisfy the install criteria.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app still works uninstalled if registration fails.
    })
  })
}
