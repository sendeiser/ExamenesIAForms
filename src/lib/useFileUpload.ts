import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

interface FileUploadState {
  progress: number;
  url: string | null;
  error: string | null;
  uploading: boolean;
}

export function useFileUpload() {
  const [state, setState] = useState<FileUploadState>({
    progress: 0,
    url: null,
    error: null,
    uploading: false,
  });

  const upload = useCallback(async (file: File, path: string) => {
    setState({ progress: 0, url: null, error: null, uploading: true });

    try {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setState((prev) => ({ ...prev, progress }));
          },
          (error) => {
            setState({ progress: 0, url: null, error: error.message, uploading: false });
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setState({ progress: 100, url, error: null, uploading: false });
            resolve(url);
          }
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir archivo';
      setState({ progress: 0, url: null, error: message, uploading: false });
      throw err;
    }
  }, []);

  const remove = useCallback(async (path: string) => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch {
      // Silently fail if file doesn't exist
    }
  }, []);

  const reset = useCallback(() => {
    setState({ progress: 0, url: null, error: null, uploading: false });
  }, []);

  return { ...state, upload, remove, reset };
}
