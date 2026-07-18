import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Tests del Block Registry (Fase 1.5). Entorno node: se valida el contrato,
// los schemas y la compatibilidad — no el DOM.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts', 'lib/**/*.test.ts'],
  },
})
