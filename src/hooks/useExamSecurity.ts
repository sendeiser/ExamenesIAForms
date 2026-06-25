import { useEffect, useRef, useState } from 'react';

export interface SecurityConfig {
  enabled: boolean;
  maxViolations: number;
  fullscreen: boolean;
  disableCopy: boolean;
  preventTabSwitch: boolean;
}

interface UseExamSecurityOptions {
  config: SecurityConfig;
  onViolation: (count: number) => void;
  onMaxViolations: () => void;
  onStart?: () => void;
}

const GRACE_MS = 8000;

export function useExamSecurity({ config, onViolation, onMaxViolations, onStart }: UseExamSecurityOptions) {
  const violations = useRef(0);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const hiddenTimer = useRef<ReturnType<typeof setTimeout>>();
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  function clearTimers() {
    if (hiddenTimer.current) { clearTimeout(hiddenTimer.current); hiddenTimer.current = undefined; }
    if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = undefined; }
  }

  function countViolation() {
    clearTimers();
    violations.current += 1;
    onViolation(violations.current);
    if (violations.current >= config.maxViolations) {
      onMaxViolations();
    }
  }

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);

    if (config.fullscreen) {
      try { document.documentElement.requestFullscreen(); } catch {}
    }

    onStart?.();
  }

  function stop() {
    startedRef.current = false;
    setStarted(false);
    clearTimers();
  }

  useEffect(() => {
    if (!config.enabled || !started) return;

    const handleVisibility = () => {
      if (!config.preventTabSwitch) return;
      if (document.hidden) {
        hiddenTimer.current = setTimeout(countViolation, GRACE_MS);
      } else {
        if (hiddenTimer.current) {
          clearTimeout(hiddenTimer.current);
          hiddenTimer.current = undefined;
        }
      }
    };

    const handleBlur = () => {
      if (!config.preventTabSwitch) return;
      blurTimer.current = setTimeout(countViolation, GRACE_MS);
    };

    const handleFocus = () => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
        blurTimer.current = undefined;
      }
    };

    const handleFullscreenChange = () => {
      if (!config.fullscreen) return;
      if (!document.fullscreenElement) {
        try { document.documentElement.requestFullscreen(); } catch {}
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (config.disableCopy) e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!config.disableCopy) return;
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (config.disableCopy) e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (config.preventTabSwitch) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (config.disableCopy) {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    }

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      if (document.fullscreenElement) document.exitFullscreen();
    };
  }, [config.enabled, config.maxViolations, config.fullscreen, config.disableCopy, config.preventTabSwitch, started]);

  return { start, stop, started };
}
