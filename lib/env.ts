export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

const DEFAULT_PUBLIC_APP_URL = "https://mica-app-nutricion.vercel.app";

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

export function getPublicAppUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!configuredUrl) {
    return DEFAULT_PUBLIC_APP_URL;
  }

  const normalized = normalizeUrl(configuredUrl);
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `https://${normalized}`;
}

export function buildPublicAppUrl(path = "/") {
  return new URL(path, `${getPublicAppUrl()}/`).toString();
}

export function hasSupabaseEnv() {
  return Boolean(getSupabaseConfig());
}