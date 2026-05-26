import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// In production (GitHub Pages), the app lives at /lift-log/.
// In development, serve from root so localhost:5174/ works directly.
const basename = import.meta.env.PROD ? '/lift-log' : '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
