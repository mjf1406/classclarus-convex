/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  /** Self-host only: when "true", login shows email/password instead of Google. */
  readonly VITE_AUTH_PASSWORD_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
