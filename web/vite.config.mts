import { defineConfig } from 'vite'

export default defineConfig({
  base: '',
  build: {
    outDir: 'js',
    lib: {
      entry: '/src/index.ts',
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.js`
    },
    sourcemap: true,
    target: 'es2022',
    minify: false,
    rollupOptions: {
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
})
