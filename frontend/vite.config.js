import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: [
      '@vee-validate/zod',
      'vee-validate',
      'zod',
      'primevue/button',
      'primevue/card',
      'primevue/inputtext',
      'primevue/message',
      'primevue/password',
      'primevue/progressbar',
      'primevue/tag',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
