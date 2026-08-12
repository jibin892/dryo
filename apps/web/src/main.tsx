import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { PhonePortraitOnly } from './app/PhonePortraitOnly'
import './shared/styles/global.css'
import './shared/styles/screens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhonePortraitOnly><App /></PhonePortraitOnly>
  </StrictMode>,
)
