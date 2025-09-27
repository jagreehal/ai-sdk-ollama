import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  server: {
    port: 3000,
    // Proxy API requests to Ollama to avoid CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        // Don't rewrite the path - Ollama needs the full /api/* path
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
    include: ['ai', 'ai-sdk-ollama']
  }
});