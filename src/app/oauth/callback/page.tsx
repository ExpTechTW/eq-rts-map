'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError('缺少 code 或 state 參數');
      return;
    }

    done.current = true;
    completeLogin(code, state)
      .then(() => {
        router.replace('/home');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '登入失敗');
        done.current = false;
      });
  }, [searchParams, completeLogin, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive">{error}</p>
        <Link href="/home" className="text-primary underline">
          返回首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-muted-foreground">登入中…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">登入中…</p>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
