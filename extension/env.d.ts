/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Forms Pilot API runs. Set in extension/.env; defaults to http://localhost:8000. */
  readonly WXT_API_URL?: string;
}
