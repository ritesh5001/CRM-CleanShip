import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Density } from '@/types';

interface UiState {
  sidebarCollapsed: boolean;
  density: Density;
  toggleSidebar: () => void;
  setDensity: (d: Density) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
    }),
    { name: 'crm-ui' }
  )
);
