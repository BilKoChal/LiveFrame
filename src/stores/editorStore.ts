/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { ActiveTab } from '../types';

interface EditorState {
  html: string;
  css: string;
  javascript: string;
  activeTab: ActiveTab;
  setHtml: (html: string) => void;
  setCss: (css: string) => void;
  setJavascript: (js: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  resetAll: () => void;
}

const DEFAULT_HTML = `<!-- LiveFrame Preview Canvas -->
<div class="card">
  <h1>LiveFrame</h1>
  <p>Build ideas instantly in real-time with HTML, CSS, and JS.</p>
  <button id="click-me">Interact with Me</button>
</div>`;

const DEFAULT_CSS = `/* Custom modern slate styling */
body {
  background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
  padding: 1.5rem;
  box-sizing: border-box;
}

.card {
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2.5rem;
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  text-align: center;
  max-width: 440px;
  width: 100%;
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 0;
  margin-bottom: 0.75rem;
  letter-spacing: -0.025em;
}

p {
  color: #94a3b8;
  line-height: 1.6;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

button {
  background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
  color: #ffffff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease-in-out;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.6);
}

button:active {
  transform: translateY(0);
}`;

const DEFAULT_JS = `// Interactive LiveFrame Scripting
const button = document.getElementById('click-me');

button.addEventListener('click', () => {
  console.log('Button interactive click triggered!');
  
  // Custom interactive visual effect
  button.textContent = 'Awesome! 👍';
  button.style.background = 'linear-gradient(135deg, #34d399 0%, #059669 100%)';
  button.style.boxShadow = '0 6px 20px 0 rgba(52, 211, 153, 0.6)';
  
  setTimeout(() => {
    button.textContent = 'Interact with Me';
    button.style.background = 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)';
    button.style.boxShadow = '0 4px 14px 0 rgba(99, 102, 241, 0.4)';
  }, 1500);
});

console.log('Document script successfully loaded and active.');
`;

export const useEditorStore = create<EditorState>((set) => ({
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  javascript: DEFAULT_JS,
  activeTab: 'html',
  setHtml: (html) => set({ html }),
  setCss: (css) => set({ css }),
  setJavascript: (javascript) => set({ javascript }),
  setActiveTab: (activeTab) => set({ activeTab }),
  resetAll: () => set({
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    javascript: DEFAULT_JS,
    activeTab: 'html',
  }),
}));
