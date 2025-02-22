import { vi } from 'vitest'

declare global {
  interface Window {
    fetch: typeof fetch;
  }
  var fetch: typeof fetch;
} 