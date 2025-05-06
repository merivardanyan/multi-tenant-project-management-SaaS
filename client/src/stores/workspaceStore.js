import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useWorkspaceStore = create(
  persist(
    (set) => ({
      currentWorkspace: null,
      setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
      clearWorkspace: () => set({ currentWorkspace: null }),
    }),
    { name: 'workspace-storage' }
  )
);

export default useWorkspaceStore;
