import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { STRINGS } from '../config/strings';
import { GenerationView } from '../ui/GenerationView';
import '../ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <main className="page">
      <h1>{STRINGS.generation.resultLabel}</h1>
      <p className="hint">{STRINGS.appName}</p>
      <div style={{ height: 16 }} />
      <GenerationView variant="editor" />
    </main>
  </StrictMode>,
);
