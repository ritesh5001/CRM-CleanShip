import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Density } from '@/types';

interface UiState {
  sidebarCollapsed: boolean;
  density: Density;
  colWidths: Record<string, number>;
  toggleSidebar: () => void;
  setDensity: (d: Density) => void;
  setColWidths: (w: Record<string, number>) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      colWidths: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
      setColWidths: (colWidths) => set({ colWidths }),
    }),
    { name: 'crm-ui' }
  )
);
