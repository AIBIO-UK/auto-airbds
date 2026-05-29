import { useEffect, useState } from "react";

/**
 * Minimal hash-based router. Returns the current hash path (without the
 * leading "#", defaulting to "/") and re-renders on navigation.
 *
 * Hash routing is used so deep links work on Cloudflare Pages without any
 * SPA-fallback server configuration.
 */
export function useHashRoute(): string {
  const [path, setPath] = useState<string>(() => currentPath());

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return path;
}

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "" ? "/" : hash;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
