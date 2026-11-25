import { useEffect, type ReactNode } from 'react';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { formatFirebaseAuthError, useAuthStore } from '../../store/authStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
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
