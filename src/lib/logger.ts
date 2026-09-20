/** Üretim derlemesinde konsol sızıntısını kapatır. */

const DEV = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

export const logger = {
  debug: (...args: unknown[]) => {
    if (DEV) console.debug(...args);
  },
  log: (...args: unknown[]) => {
    if (DEV) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (DEV) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (DEV) console.error(...args);
  },
};
