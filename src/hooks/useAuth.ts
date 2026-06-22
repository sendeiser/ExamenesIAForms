import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const logout = useAuthStore((s) => s.logout);

  return { user, loading, signInWithGoogle, logout };
}
