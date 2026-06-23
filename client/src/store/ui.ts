import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Density } from '@/types';

type Theme = 'light' | 'dark';

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

interface UiState {
  sidebarCollapsed: boolean;
  filtersCollapsed: boolean;
  density: Density;
  theme: Theme;
  colWidths: Record<string, number>;
  colOrder: string[]; // persisted order of the contacts table data columns
  hiddenCols: string[]; // contacts table columns the user has hidden
  showPhoneNumbers: boolean; // reveal the actual phone digits in the contacts table phone columns
  toggleSidebar: () => void;
  toggleFilters: () => void;
  setDensity: (d: Density) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setColWidths: (w: Record<string, number>) => void;
  setColOrder: (o: string[]) => void;
  toggleCol: (id: string) => void;
  resetCols: () => void;
  toggleShowPhoneNumbers: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      filtersCollapsed: false,
      density: 'comfortable',
      theme: systemTheme(),
      colWidths: {},
      colOrder: [],
      hiddenCols: [],
      showPhoneNumbers: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      toggleFilters: () => set((s) => ({ filtersCollapsed: !s.filtersCollapsed })),
      setDensity: (density) => set({ density }),
      setColWidths: (colWidths) => set({ colWidths }),
      setColOrder: (colOrder) => set({ colOrder }),
      toggleCol: (id) =>
        set((s) => ({
          hiddenCols: s.hiddenCols.includes(id)
            ? s.hiddenCols.filter((x) => x !== id)
            : [...s.hiddenCols, id],
        })),
      resetCols: () => set({ colOrder: [], hiddenCols: [], colWidths: {} }),
      toggleShowPhoneNumbers: () => set((s) => ({ showPhoneNumbers: !s.showPhoneNumbers })),
    }),
    { name: 'crm-ui' }
  )
);
