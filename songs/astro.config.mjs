import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://strummer.fun',
  output: 'static',
  build: {
    format: 'directory',
  },
});
