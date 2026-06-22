import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFormStore } from '../store/formStore';

export function useForms() {
  const user = useAuthStore((s) => s.user);
  const forms = useFormStore((s) => s.forms);
  const loading = useFormStore((s) => s.loading);
  const fetchForms = useFormStore((s) => s.fetchForms);
  const createForm = useFormStore((s) => s.createForm);
  const deleteForm = useFormStore((s) => s.deleteForm);
  const togglePublish = useFormStore((s) => s.togglePublish);

  useEffect(() => {
    if (user) fetchForms(user.uid);
  }, [user]);

  return { forms, loading, createForm, deleteForm, togglePublish };
}
