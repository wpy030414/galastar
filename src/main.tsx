import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { applyPrefs, readPrefs } from './store/prefs'
import './styles/globals.css'

/* 首帧之前就把主题与语言落到 <html> 上，避免深色一闪再切浅色 */
applyPrefs(readPrefs())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
