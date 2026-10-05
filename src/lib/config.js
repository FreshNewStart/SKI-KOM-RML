export const API_BASE_URL =
  import.meta.env.PUBLIC_API_URL || "http://localhost:5000/api";

export function withBase(path = "/") {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  if (!path || path === "/") {
    return base;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function buildApiUrl(path = "") {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  return `${base}${normalizedPath}`;
}
