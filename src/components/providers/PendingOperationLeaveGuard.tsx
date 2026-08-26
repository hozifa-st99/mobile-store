"use client";

import { useEffect } from "react";

import { toast } from "@/lib/toast";
import {
  PENDING_OPERATION_LEAVE_MESSAGE,
  hasPendingOperation,
  usePendingOperationStore,
} from "@/store/pending-operation-store";

function isBlockedInternalLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.getAttribute("target") === "_blank") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;

  return (
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search ||
    url.hash !== window.location.hash
  );
}

/** تحذير المتصفح + منع روابط داخلية أثناء عملية حفظ/توريد جارية. */
export default function PendingOperationLeaveGuard() {
  const pendingCount = usePendingOperationStore((state) => state.count);

  useEffect(() => {
    if (pendingCount <= 0) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = PENDING_OPERATION_LEAVE_MESSAGE;
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (!hasPendingOperation()) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isBlockedInternalLink(anchor)) return;

      event.preventDefault();
      event.stopPropagation();
      toast.warning(PENDING_OPERATION_LEAVE_MESSAGE);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    history.pushState({ __pendingOpGuard: true }, "", window.location.href);

    const onPopState = () => {
      if (!hasPendingOperation()) return;
      history.pushState({ __pendingOpGuard: true }, "", window.location.href);
      toast.warning(PENDING_OPERATION_LEAVE_MESSAGE);
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pendingCount]);

  return null;
}
