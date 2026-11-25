import { useEffect, type ReactNode } from 'react';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import {
  AUTH_REDIRECT_PENDING_KEY,
  formatFirebaseAuthError,
  useAuthStore,
} from '../../store/authStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        let wasPending = false;
        try {
          wasPending = sessionStorage.getItem(AUTH_REDIRECT_PENDING_KEY) === '1';
          sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY);
        } catch {}

        if (result?.user) {
          setUser(result.user);
          setError(null);
          return;
        }

        if (wasPending && !auth.currentUser) {
          const host = typeof window !== 'undefined' ? window.location.hostname : '';
          setError(
            `El navegador bloqueó el retorno de Google por redirección entre dominios (${auth.config?.authDomain ?? 'firebaseapp.com'} ↔ ${host}). Pulsa "Continuar con Google" arriba y permite las ventanas emergentes para este sitio.`
          );
        }
      })
      .catch((err) => {
        try {
          sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY);
        } catch {}
        setError(formatFirebaseAuthError(err));
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading, setError]);

  return <>{children}</>;
}
