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
  build: {
    minify: false,
    lib: {
      entry: getAllFiles(resolve(__dirname, 'src')),
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  esbuild: {
    legalComments: 'inline', // Keeps comments like /* @preserve */
    banner: ' ',             // Prevents some default header removals
    // To keep ALL comments (including regular ones), use:
    ignoreAnnotations: true,
  },
});