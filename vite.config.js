import { defineConfig } from 'vite'

const fullReloadAlways = {
  name: 'full-reload-always',
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" })
    return []
  },
}

export default defineConfig({
  root: '',
  base: './',
  plugins: [fullReloadAlways],
  server: {
    port: 5176,
    watch: {
      ignored: ['**/*.md', '**/*.txt', '**/docs/**'],
    },
  },
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
