import { useToastStore, type ToastType } from "@/store/toast-store";

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  error: 6000,
  warning: 5500,
  success: 4000,
  info: 4500,
};

function show(type: ToastType, message: string) {
  if (typeof window === "undefined") return;

  const trimmed = message.trim();
  if (!trimmed) return;

  const id = useToastStore.getState().push(type, trimmed);

  window.setTimeout(() => {
    useToastStore.getState().dismiss(id);
  }, AUTO_DISMISS_MS[type]);
}

export const toast = {
  error: (message: string) => show("error", message),
  success: (message: string) => show("success", message),
  info: (message: string) => show("info", message),
  warning: (message: string) => show("warning", message),
};
