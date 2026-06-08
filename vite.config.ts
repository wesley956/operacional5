import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig(({ mode }) => {
  const useSingleFile =
    mode === 'singlefile' ||
    process.env.VITE_SINGLE_FILE === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(useSingleFile ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: useSingleFile
        ? undefined
        : {
            output: {
              manualChunks(id) {
                if (!id.includes('node_modules')) return undefined;

                if (id.includes('@supabase')) return 'vendor-supabase';
                if (
                  id.includes('react') ||
                  id.includes('react-dom') ||
                  id.includes('react-router-dom')
                ) {
                  return 'vendor-react';
                }
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('date-fns')) return 'vendor-date';

                return 'vendor';
              },
            },
          },
    },
  };
});
