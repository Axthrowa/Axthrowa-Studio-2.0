/// <reference types="vite/client" />

/** package.json sürümü (vite.config define) */
declare const __YYA_SURUM__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_STREAMAXT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
