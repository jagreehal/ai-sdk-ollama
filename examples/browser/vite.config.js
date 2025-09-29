import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { apiPlugin } from './vite-api-plugin';

export default defineConfig({
  plugins: [
    tailwindcss(),
    apiPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  server: {
    port: 3000,
    // Proxy API requests to Ollama to avoid CORS issues
    proxy: {
      '/api/tags': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request:', req.method, req.url, '-> http://localhost:11434' + req.url);
          });
        }
      }
    }
  },
  optimizeDeps: {
    include: ['ai', 'ai-sdk-ollama', 'react', 'react-dom', '@ai-sdk/react']
  }
});