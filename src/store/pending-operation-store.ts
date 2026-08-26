import { create } from "zustand";

import { toast } from "@/lib/toast";

interface PendingOperationState {
  count: number;
  begin: () => void;
  end: () => void;
  reset: () => void;
}

export const usePendingOperationStore = create<PendingOperationState>((set, get) => ({
  count: 0,
  begin: () => set((state) => ({ count: state.count + 1 })),
  end: () => set((state) => ({ count: Math.max(0, state.count - 1) })),
  reset: () => set({ count: 0 }),
}));

export function hasPendingOperation() {
  return usePendingOperationStore.getState().count > 0;
}

export function resetPendingOperations() {
  usePendingOperationStore.getState().reset();
}

export const PENDING_OPERATION_LEAVE_MESSAGE =
  "في عملية جارية — استنى لحد ما تخلص قبل مغادرة الصفحة";

function guardWhilePending(message: string, action: () => void) {
  if (hasPendingOperation()) {
    toast.warning(message);
    return;
  }
  action();
}

export function guardBranchSwitch(action: () => void) {
  guardWhilePending("في عملية جارية — استنى لحد ما تخلص قبل تغيير الفرع", action);
}

export function guardLogout(action: () => void) {
  guardWhilePending("في عملية جارية — استنى لحد ما تخلص قبل تسجيل الخروج", action);
}

export async function runPendingOperation<T>(operation: () => Promise<T>): Promise<T> {
  const { begin, end } = usePendingOperationStore.getState();
  begin();
  try {
    return await operation();
  } finally {
    end();
  }
}
