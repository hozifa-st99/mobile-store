import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AllowedScreens } from "@/lib/permissions";
import { clearDashboardCaches } from "@/lib/dashboard-cache";
import { resetPendingOperations } from "@/store/pending-operation-store";

export interface Branch {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isDefault?: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  companyName: string;
}

interface AuthState {
  user: User | null;
  branches: Branch[];
  selectedBranch: Branch | null;
  allowedScreens: AllowedScreens;
  companyLogoUrl: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, branches: Branch[], allowedScreens?: AllowedScreens) => void;
  updateCompanyName: (companyName: string) => void;
  updateCompanyLogoUrl: (logoUrl: string | null) => void;
  setBranch: (branch: Branch) => void;
  clearSelectedBranch: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      branches: [],
      selectedBranch: null,
      allowedScreens: "all",
      companyLogoUrl: null,
      isAuthenticated: false,
      setAuth: (user, branches, allowedScreens = "all") => {
        clearDashboardCaches();
        set({
          user,
          branches,
          selectedBranch: null,
          allowedScreens,
          isAuthenticated: true,
        });
      },
      updateCompanyName: (companyName) =>
        set((state) => ({
          user: state.user ? { ...state.user, companyName } : null,
        })),
      updateCompanyLogoUrl: (logoUrl) => set({ companyLogoUrl: logoUrl }),
      setBranch: (branch) => {
        clearDashboardCaches();
        set({ selectedBranch: branch });
      },
      clearSelectedBranch: () => {
        clearDashboardCaches();
        set({ selectedBranch: null });
      },
      logout: () => {
        clearDashboardCaches();
        resetPendingOperations();
        set({
          user: null,
          branches: [],
          selectedBranch: null,
          allowedScreens: "all",
          companyLogoUrl: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "mobile-store-auth",
      merge: (persisted, current) => {
        const saved = persisted as Partial<AuthState> | undefined;
        return {
          ...current,
          ...saved,
          allowedScreens: saved?.allowedScreens ?? current.allowedScreens,
        };
      },
    }
  )
);
