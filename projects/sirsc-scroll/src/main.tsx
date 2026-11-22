import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/feed.css';
import './styles/panel.css';
import './styles/widgets.css';
import './styles/placeholders.css';
import './styles/pages.css';
import './styles/modals.css';
import './styles/mobile.css';
import './styles/motion.css';
import { App } from './App';
import { initMotion } from './lib/motion';

initMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
