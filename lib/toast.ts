export type ToastTone = "success" | "error" | "warning" | "info";

const LOCAL_HOST_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
  /github\.dev$/i,
];

export function isLocalLikeHost(host: string) {
  return LOCAL_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export function normalizeToastTone(value?: string | null): ToastTone | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "success"
    || normalized === "error"
    || normalized === "warning"
    || normalized === "info"
  ) {
    return normalized;
  }

  return null;
}

export function inferToastTone(message: string): ToastTone {
  const text = message.trim().toLowerCase();

  if (
    /no se pudo|no fue posible|error|inval|incorrect|fall|falt|obligatori|deneg|ya no existe|requerid/.test(text)
  ) {
    return "error";
  }

  if (/confirma|revisa|pendiente|prepar|atencion|aviso|verifica/.test(text)) {
    return "warning";
  }

  if (/cread|actualiz|eliminad|guardad|correctamente|list[oa]|confirmad|iniciad|cerrad|habilitad/.test(text)) {
    return "success";
  }

  return "info";
}

export function appendToastToPath(
  path: string,
  message: string,
  tone?: ToastTone,
  title?: string,
) {
  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = pathWithoutHash.split("?", 2);
  const search = new URLSearchParams(query);

  search.set("message", message);
  search.set("toast", tone ?? inferToastTone(message));

  if (title) {
    search.set("title", title);
  }

  const nextPath = search.toString() ? `${pathname}?${search.toString()}` : pathname;
  return hash ? `${nextPath}#${hash}` : nextPath;
}