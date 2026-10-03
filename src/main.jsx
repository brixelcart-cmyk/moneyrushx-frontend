import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init } from '@telegram-apps/sdk-react'
import './index.css'
import App from './App.jsx'

try {
  init()
} catch (error) {
  console.log('Telegram SDK not running inside Telegram:', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)