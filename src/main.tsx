
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Walkthrough from './walkthrough/walkthrough.tsx'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/walkthrough" element={<Walkthrough />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
