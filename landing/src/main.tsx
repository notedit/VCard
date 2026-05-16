import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './LandingPage';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('root container not found');

createRoot(container).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
