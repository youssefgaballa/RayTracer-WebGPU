// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'node:fs'; // Use the node: prefix for clarity

const getAllFiles = (dir: string) => {
  let files: string[] = [];
  // Verify directory exists to prevent errors
  if (!fs.existsSync(dir)) return files;

  fs.readdirSync(dir).forEach((file) => {
    const filePath = resolve(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      files = [...files, ...getAllFiles(filePath)];
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      files.push(filePath);
    }
  });
  return files;
};
export default defineConfig({
  assetsInclude: ['**/*.wgsl'],
  build: {
    minify: 'terser', // Switch from esbuild to terser
    terserOptions: {
      compress: false, // Don't compress code
      mangle: false,   // Don't rename variables
      format: {
        comments: 'all', // PRESERVE ALL COMMENTS (inline and block)
        beautify: true,  // Keeps code readable
      },
    },
    
    lib: {
      entry: getAllFiles(resolve(__dirname, 'src')),
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: '[name][ext]',
      },
    },
  }
});