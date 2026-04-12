/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISTRIBUTION_CHANNEL?: 'sideload' | 'play-store' | 'app-store';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
