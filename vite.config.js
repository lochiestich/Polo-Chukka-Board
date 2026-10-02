import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works under any GitHub Pages path
// (e.g. https://<user>.github.io/Polo-Chukka-Board/).
export default defineConfig({
  plugins: [react()],
  base: './',
});
