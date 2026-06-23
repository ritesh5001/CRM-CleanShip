import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Density } from '@/types';

type Theme = 'light' | 'dark';

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** Persisted filter/sort/paging state for the contacts & leads views. */
export interface ContactFilters {
  search: string;
  status: string;
  callStatus: string;
  assignedTo: string;
  qualifiedChip: boolean;
  sortBy: string;
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

export const DEFAULT_CONTACT_FILTERS: ContactFilters = {
  search: '',
  status: '',
  callStatus: '',
  assignedTo: '',
  qualifiedChip: false,
  sortBy: 'createdAt',
  order: 'desc',
  page: 1,
  limit: 50,
};

interface UiState {
  sidebarCollapsed: boolean;
  filtersCollapsed: boolean;
  density: Density;
  theme: Theme;
  colWidths: Record<string, number>;
  colOrder: string[]; // persisted order of the contacts table data columns
  hiddenCols: string[]; // contacts table columns the user has hidden
  showPhoneNumbers: boolean; // reveal the actual phone digits in the contacts table phone columns
  contactFilters: Record<'contacts' | 'leads', ContactFilters>; // remembered search/sort/paging per view
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
  setContactFilters: (mode: 'contacts' | 'leads', filters: ContactFilters) => void;
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
      contactFilters: { contacts: { ...DEFAULT_CONTACT_FILTERS }, leads: { ...DEFAULT_CONTACT_FILTERS } },
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
      setContactFilters: (mode, filters) =>
        set((s) => ({ contactFilters: { ...s.contactFilters, [mode]: filters } })),
    }),
    { name: 'crm-ui' }
  )
);
