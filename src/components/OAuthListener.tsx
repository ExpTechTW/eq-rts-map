'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function OAuthListener() {
  const { completeLogin } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onOAuthCallback) return;
    const unsubscribe = window.electronAPI.onOAuthCallback(({ code, state }) => {
      completeLogin(code, state).catch(console.error);
    });
    return unsubscribe;
  }, [completeLogin]);

  return null;
}
