/**
 * OAuth2 PKCE + token 交換（對接 api.md）
 * Base: https://exptech.com.tw
 */

const API_BASE = 'https://manager.exptech.com.tw';

/** 登入頁面 origin（網頁登入在 http://localhost:5173） */
const LOGIN_PAGE_ORIGIN = 'http://localhost:5173';

/** OAuth2 client_id（public client，硬編碼即可） */
export const OAUTH_CLIENT_ID = '20260202';

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64Url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await sha256Base64Url(codeVerifier);
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
  state?: string;
}): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (params.scope) q.set('scope', params.scope);
  if (params.state) q.set('state', params.state);
  return `${API_BASE}/api/v1/oauth2/authorize?${q.toString()}`;
}

/** 登入頁 URL（next 已 encode，避免授權 URL 被截斷） */
export function buildLoginUrl(authorizeUrl: string): string {
  return `${LOGIN_PAGE_ORIGIN}/oauth?next=${encodeURIComponent(authorizeUrl)}`;
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}): Promise<{ accessToken: string; scope: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(`${API_BASE}/api/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    scope: data.scope ?? '',
  };
}

export async function fetchUserInfo(accessToken: string): Promise<{ sub: string; email: string }> {
  if (typeof window !== 'undefined' && window.electronAPI?.oauthUserInfo) {
    return window.electronAPI.oauthUserInfo(accessToken);
  }
  const res = await fetch(`${API_BASE}/api/v1/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('userinfo failed');
  return res.json();
}
