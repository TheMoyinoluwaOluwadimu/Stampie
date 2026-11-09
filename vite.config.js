import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build working on GitHub Pages and any sub-path host.
export default defineConfig({ plugins: [react()], base: './' })
