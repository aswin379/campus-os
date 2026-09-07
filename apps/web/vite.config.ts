import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // `vite` runs with cwd = apps/web (npm workspaces), so envDir must be set
  // explicitly — Vite's default envDir is `root`, which defaults to
  // process.cwd(), NOT the monorepo root where the actual `.env` lives.
  // Without this, `import.meta.env.VITE_API_BASE_URL` is silently
  // `undefined` (apps/web/.env doesn't exist) and every build/dev run falls
  // back to the hardcoded default in api/client.ts, ignoring `.env` entirely.
  envDir: '../../',
  server: {
    port: 5173,
    host: true,
  },
});
