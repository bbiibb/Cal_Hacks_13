
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Walkthrough from './walkthrough/walkthrough.tsx'
import WalkthroughsList from './walkthroughs_list/walkthroughs_list.tsx'
import SiteLayout from './layout/site_layout.tsx'
import ComingSoon from './coming_soon/coming_soon.tsx'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* The header lives in SiteLayout, so it stays put while pages change */}
        <Route element={<SiteLayout />}>
          <Route path="/" element={<App />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
          <Route path="/walkthroughs-list" element={<WalkthroughsList />} />
          <Route path="*" element={<ComingSoon />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
