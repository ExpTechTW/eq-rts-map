'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createPKCE,
  buildAuthorizeUrl,
  buildLoginUrl,
  exchangeCodeForToken,
  fetchUserInfo,
} from '@/lib/auth';

const REDIRECT_URI_ELECTRON = 'eq-rts-map://oauth/callback';

function getRedirectUri(): string {
  if (typeof window === 'undefined') return REDIRECT_URI_ELECTRON;
  if (window.electronAPI) return REDIRECT_URI_ELECTRON;
  return `${window.location.origin}/oauth/callback`;
}

const STORAGE_TOKEN_KEY = 'exptech_access_token';
const STORAGE_USER_KEY = 'exptech_user';
const PKCE_STORAGE_KEY = 'exptech_oauth_pkce';

export interface ExptechUser {
  sub: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  user: ExptechUser | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: () => Promise<string>;
  completeLogin: (code: string, state: string) => Promise<void>;
  logout: () => void;
  getAuthorizeUrl: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStored(): { accessToken: string | null; user: ExptechUser | null } {
  if (typeof window === 'undefined') return { accessToken: null, user: null };
  try {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    const userRaw = localStorage.getItem(STORAGE_USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as ExptechUser) : null;
    return { accessToken: token, user };
  } catch {
    return { accessToken: null, user: null };
  }
}

export function AuthProvider({
  children,
  clientId,
}: {
  children: React.ReactNode;
  clientId: string;
}) {
  const [state, setState] = useState<AuthState>({
    ...loadStored(),
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const { accessToken } = loadStored();
    if (!accessToken) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    fetchUserInfo(accessToken)
      .then((user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        }
        setState((s) => ({ ...s, user, isLoading: false, error: null }));
      })
      .catch(() => {
        if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_TOKEN_KEY);
        setState((s) => ({ ...s, accessToken: null, user: null, isLoading: false }));
      });
  }, []);

  const getAuthorizeUrl = useCallback(async (): Promise<string> => {
    const { codeVerifier, codeChallenge } = await createPKCE();
    const state = crypto.randomUUID();
    const redirectUri = getRedirectUri();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ codeVerifier, state, redirectUri }));
    }
    return buildAuthorizeUrl({
      clientId,
      redirectUri,
      codeChallenge,
      scope: 'http.* websocket.*',
      state,
    });
  }, [clientId]);

  const login = useCallback(async (): Promise<string> => {
    setState((s) => ({ ...s, error: null }));
    const authorizeUrl = await getAuthorizeUrl();
    const url = buildLoginUrl(authorizeUrl);
    if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(url);
    } else {
      window.location.href = url;
    }
    return url;
  }, [getAuthorizeUrl]);

  const completeLogin = useCallback(
    async (code: string, stateParam: string) => {
      if (typeof window === 'undefined') return;
      const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
      sessionStorage.removeItem(PKCE_STORAGE_KEY);
      if (!raw) throw new Error('No PKCE state found');
      const { codeVerifier, state, redirectUri } = JSON.parse(raw) as {
        codeVerifier: string;
        state: string;
        redirectUri?: string;
      };
      const redirectUriToUse = redirectUri ?? getRedirectUri();
      if (state !== stateParam) throw new Error('state mismatch');

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        let accessToken: string;
        if (typeof window !== 'undefined' && window.electronAPI?.oauthExchange) {
          const result = await window.electronAPI.oauthExchange(code, redirectUriToUse, codeVerifier);
          accessToken = result.accessToken;
        } else {
          const result = await exchangeCodeForToken({
            code,
            redirectUri: redirectUriToUse,
            clientId,
            codeVerifier,
          });
          accessToken = result.accessToken;
        }

        const user = await fetchUserInfo(accessToken);
        localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        setState({ accessToken, user, isLoading: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setState((s) => ({ ...s, isLoading: false, error: message }));
        throw err;
      }
    },
    [clientId]
  );

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    }
    setState({ accessToken: null, user: null, isLoading: false, error: null });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    completeLogin,
    logout,
    getAuthorizeUrl,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
