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
import './styles/youtube.css';
import './styles/review.css';
import './styles/auth.css';
import { App } from './App';
import { initMotion } from './lib/motion';
import { startAccounts } from './lib/accounts';
import { setTransport } from './lib/warden';
import { demoTransport } from './lib/demoBackend';

initMotion();
// The demo builds (the claude.ai Artifact) talk to a pretend Warden Chat instead of Supabase.
if (__DEMO_BACKEND__) setTransport(demoTransport);
startAccounts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
