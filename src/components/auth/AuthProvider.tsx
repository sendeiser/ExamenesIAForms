import { useEffect, type ReactNode } from 'react';
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth';
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
    let wasPending = false;
    try {
      wasPending = sessionStorage.getItem(AUTH_REDIRECT_PENDING_KEY) === '1';
    } catch {}

    let redirectSettled = !wasPending;
    let latestUser: User | null = null;

    getRedirectResult(auth)
      .then((result) => {
        try {
          sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY);
        } catch {}
        redirectSettled = true;

        if (result?.user) {
          setUser(result.user);
          setError(null);
          setLoading(false);
          return;
        }

        if (auth.currentUser) {
          setUser(auth.currentUser);
          setLoading(false);
          return;
        }

        setUser(latestUser);
        setLoading(false);

        if (wasPending) {
          const host = typeof window !== 'undefined' ? window.location.hostname : '';
          const isSameOrigin = auth.config?.authDomain === host;
          setError(
            isSameOrigin
              ? `No se pudo completar el retorno de Google en "${host}". Verifica que las cookies y el almacenamiento del sitio estén habilitados e inténtalo nuevamente.`
              : `El navegador bloqueó el retorno de Google por redirección entre dominios (${auth.config?.authDomain ?? 'firebaseapp.com'} ↔ ${host}). Pulsa "Continuar con Google" arriba y permite las ventanas emergentes para este sitio.`
          );
        }
      })
      .catch((err) => {
        try {
          sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY);
        } catch {}
        redirectSettled = true;
        setError(formatFirebaseAuthError(err));
        setUser(auth.currentUser);
        setLoading(false);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      latestUser = user;
      if (user && !user.isAnonymous) {
        setUser(user);
        setLoading(false);
      } else if (redirectSettled) {
        setUser(user);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [setUser, setLoading, setError]);

  return <>{children}</>;
}
