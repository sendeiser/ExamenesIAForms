import { create } from 'zustand';
import { signInWithRedirect, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  signInWithGoogle: async () => {
    try {
      set({ error: null });
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      set({ error: err?.message ?? 'Error al iniciar sesión' });
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      set({ error: err?.message ?? 'Error al cerrar sesión' });
    }
  },

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  clearError: () => set({ error: null }),
}));
