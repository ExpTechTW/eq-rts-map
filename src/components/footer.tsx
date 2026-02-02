'use client';

import { Github, Activity, AudioWaveform, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useElectronUpdater } from '@/hooks/useElectronUpdater';
import { useAuth } from '@/contexts/AuthContext';

type DisplayMode = 'waveform' | 'spectrogram';

interface FooterProps {
  displayMode?: DisplayMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
}

export default function Footer({ displayMode = 'waveform', onDisplayModeChange }: FooterProps) {
  const { currentVersion, openExternal } = useElectronUpdater();
  const { accessToken, user, login, logout, isLoading, error } = useAuth();
  const [version, setVersion] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setVersion(currentVersion || '1.0.0');
  }, [currentVersion]);

  const handleGithubClick = () => {
    openExternal('https://github.com/ExpTechTW/eq-rts-map').catch(console.error);
  };

  const toggleDisplayMode = () => {
    onDisplayModeChange?.(displayMode === 'waveform' ? 'spectrogram' : 'waveform');
  };

  const Divider = () => <div className="w-px h-3 bg-border/60" />;

  return (
    <footer className="fixed bottom-3 left-3 z-50">
      <div className="bg-background/90 backdrop-blur-sm border border-border/50 rounded-md px-1.5 py-1.5 shadow-md flex items-center gap-1.5">
        <p className="text-[10px] text-muted-foreground font-medium pl-1">{version}</p>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-5 w-5 hover:bg-accent/50"
          title={collapsed ? '展開' : '收合'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <Divider />
        {accessToken && user ? (
          <>
            <span className="text-[10px] text-muted-foreground max-w-[100px] truncate" title={user.email}>
              {user.email.split('@')[0]}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="h-5 w-5 hover:bg-accent/50"
              title="登出"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => login().catch(console.error)}
            className="h-5 w-5 hover:bg-accent/50"
            title={error ?? '登入 Exptech'}
            disabled={isLoading}
          >
            <LogIn className="h-3 w-3" />
          </Button>
        )}

        {!collapsed && (
          <>
            {onDisplayModeChange && (
              <>
                <Divider />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDisplayMode}
                  className="h-5 w-5 hover:bg-accent/50 text-blue-400"
                  title={displayMode === 'waveform' ? '切換到頻譜圖' : '切換到波形圖'}
                >
                  {displayMode === 'waveform' ? <Activity className="h-3 w-3" /> : <AudioWaveform className="h-3 w-3" />}
                </Button>
              </>
            )}
            <Divider />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGithubClick}
              className="h-5 w-5 hover:bg-accent/50"
              title="GitHub Repository"
            >
              <Github className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </footer>
  );
}
