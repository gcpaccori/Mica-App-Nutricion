export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

import { isLocalLikeHost } from "@/lib/toast";

const DEFAULT_PUBLIC_APP_URL = "https://mica-app-nutricion.vercel.app";

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function toAbsoluteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function isPublicAppCandidate(url: string) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    return !isLocalLikeHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function getPublicAppUrl() {
  const configuredUrls = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter((value): value is string => Boolean(value?.trim()));

  const publicUrl = configuredUrls.find(isPublicAppCandidate);

  if (!publicUrl) {
    return DEFAULT_PUBLIC_APP_URL;
  }

  return normalizeUrl(toAbsoluteUrl(publicUrl));
}

export function buildPublicAppUrl(path = "/") {
  return new URL(path, `${getPublicAppUrl()}/`).toString();
}

export function hasSupabaseEnv() {
  return Boolean(getSupabaseConfig());
}