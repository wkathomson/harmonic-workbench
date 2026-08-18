import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this project from /harmonic-workbench/, not the
  // domain root, so built asset URLs need that prefix. Only applied to
  // `vite build` — the dev server stays at / so localhost:5173 is unchanged.
  base: command === 'build' ? '/harmonic-workbench/' : '/',
}))
