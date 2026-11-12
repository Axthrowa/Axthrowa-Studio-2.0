/// <reference types="vite/client" />

/** package.json sürümü (vite.config define) */
declare const __STUDIO_SURUM__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_AXBOT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
