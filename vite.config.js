import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { env } from 'node:process'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [env.MONEYRUSHX_FRONTEND_HOST || 'madonna-opportunities-coral-levy.trycloudflare.com', 'entitled-dem-marvel-penny.trycloudflare.com'],
  },
})
