import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithGoogleRedirect = useAuthStore((s) => s.signInWithGoogleRedirect);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    loading,
    signingIn,
    error,
    signInWithGoogle,
    signInWithGoogleRedirect,
    logout,
    clearError,
  };
}
