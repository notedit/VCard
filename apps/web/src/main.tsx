import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getUserId } from './lib/user-id';
import './styles/global.css';

getUserId();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
