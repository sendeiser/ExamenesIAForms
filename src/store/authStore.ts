import { create } from 'zustand';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export function formatFirebaseAuthError(err: any): string {
  const code = typeof err?.code === 'string' ? err.code : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `El dominio "${host}" no está autorizado en Firebase Authentication > Settings > Authorized domains (${code}).`;
    case 'auth/popup-blocked':
      return `El navegador bloqueó la ventana emergente de Google. Intenta nuevamente o usa el acceso en esta misma pestaña (${code}).`;
    case 'auth/popup-closed-by-user':
      return `Se cerró la ventana de inicio de sesión antes de completar el ingreso (${code}).`;
    case 'auth/cancelled-popup-request':
      return `La solicitud anterior de inicio de sesión fue cancelada. Vuelve a intentarlo (${code}).`;
    case 'auth/operation-not-allowed':
      return `El proveedor Google no está habilitado en Firebase Console > Authentication > Sign-in method (${code}).`;
    case 'auth/network-request-failed':
      return `Error de red al conectar con Google / Firebase. Verifica tu conexión (${code}).`;
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return `Configuración de Firebase inválida o no autorizada (${code}).`;
    default: {
      const base = err?.message || 'Error al iniciar sesión con Google';
      return code ? `${base} (${code})` : base;
    }
  }
}

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signingIn: false,
  error: null,

  signInWithGoogle: async () => {
    set({ error: null, signingIn: true });
    const provider = buildGoogleProvider();
    try {
      await signInWithPopup(auth, provider);
      set({ signingIn: false });
    } catch (err: any) {
      const code = err?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          set({ error: formatFirebaseAuthError(redirectErr), signingIn: false });
          return;
        }
      }
      set({ error: formatFirebaseAuthError(err), signingIn: false });
    }
  },

  signInWithGoogleRedirect: async () => {
    set({ error: null, signingIn: true });
    try {
      await signInWithRedirect(auth, buildGoogleProvider());
    } catch (err: any) {
      set({ error: formatFirebaseAuthError(err), signingIn: false });
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      set({ error: formatFirebaseAuthError(err) });
    }
  },

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
