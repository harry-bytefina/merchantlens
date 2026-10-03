import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5175,
    proxy: { '/api': { target: 'http://127.0.0.1:5180', changeOrigin: true } },
  },
  preview: { host: '127.0.0.1', port: 5175 },
});
