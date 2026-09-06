import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  base: mode === 'singlefile' ? './' : '/outgunned-toolkit/',
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  build: { target: 'es2020' }
}))
