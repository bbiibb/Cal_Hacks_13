
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Landing from './landing/landing.tsx'
import Walkthrough from './walkthrough/walkthrough.tsx'
import WalkthroughsList from './walkthroughs_list/walkthroughs_list.tsx'
import SiteLayout from './layout/site_layout.tsx'
import Login from './auth/login.tsx'
import Signup from './auth/signup.tsx'
import Faqs from './faqs/faqs.tsx'
import DevicesLab from './devices_lab/devices_lab.tsx'
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
          <Route path="/" element={<Landing />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
          <Route path="/walkthroughs-list" element={<WalkthroughsList />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/devices-lab" element={<DevicesLab />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<ComingSoon />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
