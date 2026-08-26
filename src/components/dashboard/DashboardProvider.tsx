"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiJson } from "@/lib/api-client";
import {
  normalizeDashboardData,
  readDashboardCache,
  writeDashboardCache,
} from "@/lib/dashboard-cache";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData, emptyDashboard } from "./dashboard-types";

type DashboardContextValue = DashboardData & {
  refresh: () => void;
  loading: boolean;
  hasWarmCache: boolean;
};

const DashboardContext = createContext<DashboardContextValue>({
  ...emptyDashboard,
  refresh: () => {},
  loading: false,
  hasWarmCache: false,
});

export function useDashboard() {
  return useContext(DashboardContext);
}

const DASHBOARD_FETCH: RequestInit = { cache: "no-store" };

export function DashboardProvider({ children }: { children: ReactNode }) {
  const branchId = useAuthStore((state) => state.selectedBranch?.id ?? null);
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [hasWarmCache, setHasWarmCache] = useState(false);
  const fetchSeqRef = useRef(0);

  const runFetch = useCallback(async (activeBranchId: string, seq: number) => {
    setLoading(true);

    try {
      const { ok, data: payload } = await apiJson<DashboardData>(
        "/api/dashboard",
        DASHBOARD_FETCH
      );

      if (seq !== fetchSeqRef.current) return;
      if (useAuthStore.getState().selectedBranch?.id !== activeBranchId) return;
      if (!ok || !payload) return;

      const merged = normalizeDashboardData(payload);
      setData(merged);
      writeDashboardCache(activeBranchId, merged);
      setHasWarmCache(true);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    if (!branchId) return;
    const seq = ++fetchSeqRef.current;
    void runFetch(branchId, seq);
  }, [branchId, runFetch]);

  useEffect(() => {
    if (!branchId) {
      fetchSeqRef.current += 1;
      setData(emptyDashboard);
      setLoading(false);
      setHasWarmCache(false);
      return;
    }

    const cached = readDashboardCache(branchId);
    setHasWarmCache(Boolean(cached));
    setData(cached ?? emptyDashboard);

    const seq = ++fetchSeqRef.current;
    void runFetch(branchId, seq);

    return () => {
      fetchSeqRef.current += 1;
    };
  }, [branchId, runFetch]);

  return (
    <DashboardContext.Provider value={{ ...data, refresh, loading, hasWarmCache }}>
      {children}
    </DashboardContext.Provider>
  );
}
