/**
 * Browsers attach an Origin header to cross-site requests. The API only answers pages served from
 * this machine (the app itself, the Vite dev server, the desktop shell); tools such as curl hooks or
 * MCP clients send no Origin and are not affected.
 */
const LOCAL = /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?|tauri:\/\/localhost|https?:\/\/tauri\.localhost)$/;

export const isLocalOrigin = (origin: string | null | undefined) => !origin || LOCAL.test(origin);

/** Allowed: no Origin, a local page, or the very address the app is served from (Host header). */
export const isAllowedOrigin = (origin: string | null | undefined, host: string | null | undefined) => {
  if (isLocalOrigin(origin)) return true;
  try {
    return !!host && new URL(origin!).host === host;
  } catch {
    return false;
  }
};
