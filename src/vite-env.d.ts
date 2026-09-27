/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_STREAMAXT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
