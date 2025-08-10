import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_USE_MEDIA_API': JSON.stringify('true')
  },
  server: {
    // Handle SPA routing - serve index.html for all routes
    historyApiFallback: true,
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor'
            if (id.includes('firebase')) return 'firebase-vendor'
            if (id.includes('lucide-react')) return 'icons-vendor'
            return 'vendor'
          }
        },
      },
    },
  },
  // Ensure proper base path for deployment
  base: '/',
})
