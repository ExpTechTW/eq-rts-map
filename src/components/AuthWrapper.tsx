'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { OAuthListener } from './OAuthListener';
import { OAUTH_CLIENT_ID } from '@/lib/auth';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider clientId={OAUTH_CLIENT_ID}>
      <OAuthListener />
      {children}
    </AuthProvider>
  );
}
