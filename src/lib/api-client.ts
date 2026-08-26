import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

function expireClientSession() {
  if (typeof window === "undefined") return;

  const { isAuthenticated, logout } = useAuthStore.getState();
  if (!isAuthenticated) return;
  logout();
  toast.error("انتهت الجلسة — سجّل الدخول مجدداً");
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.replace("/");
  }
}

function cloneFormData(form: FormData): FormData {
  const clone = new FormData();
  for (const [key, value] of form.entries()) {
    clone.append(key, value);
  }
  return clone;
}

/** fetch مع تجديد الجلسة تلقائياً عند 401 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const retryOptions =
    options?.body instanceof FormData
      ? { ...options, body: cloneFormData(options.body) }
      : options;

  let res = await fetch(url, { credentials: "include", ...options });
  if (res.status !== 401) return res;

  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  if (!refreshed) {
    expireClientSession();
    return res;
  }

  return fetch(url, { credentials: "include", ...retryOptions });
}

/** fetch + JSON مع credentials وتجديد الجلسة */
export async function apiJson<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; data: T; status: number }> {
  const res = await apiFetch(url, options);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, data, status: res.status };
}
