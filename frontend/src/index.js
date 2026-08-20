import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { installSafariDateShim } from './utils/dateCompat';
import socket from './socket/socket';

// Make Safari/iOS tolerant of MySQL "YYYY-MM-DD HH:MM:SS" date strings before
// any component renders. No-op on Chrome/Firefox which already parse them.
installSafariDateShim();

window.socket = socket;

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

// Register the PWA service worker for full offline asset caching
serviceWorkerRegistration.register();



