import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    rolldownOptions: { input: ['index.html', 'history.html'] },
  },
  plugins: [
    react(),
    {
      name: 'serve-archive-photos',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/photos/')) req.url = '/fangyi-timelapse' + req.url;
          next();
        });
      },
    },
  ],
});
