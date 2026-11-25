import { defineConfig } from 'vite';

export default defineConfig({
  // Arena previews are served through a generated HTTPS hostname.
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  // Firebase products share one global component registry. Dedupe the
  // internal core packages so App Check registers on the same FirebaseApp
  // instance created by firebase/app.
  resolve: {
    dedupe: ['@firebase/app', '@firebase/component', '@firebase/util'],
  },
  build: {
    // Firestore is dynamically loaded only for Firebase-configured deployments.
    // Its 567 kB minified / 169 kB gzip vendor module is intentionally separate
    // from the 22 kB local/offline safety app shell.
    chunkSizeWarningLimit: 600,
  },
});
