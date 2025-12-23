'use client';

import { Github, Activity, AudioWaveform, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useElectronUpdater } from '@/hooks/useElectronUpdater';

type DisplayMode = 'waveform' | 'spectrogram';

interface FooterProps {
  displayMode?: DisplayMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
}

export default function Footer({ displayMode = 'waveform', onDisplayModeChange }: FooterProps) {
  const { currentVersion, openExternal } = useElectronUpdater();
  const [version, setVersion] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setVersion(currentVersion || '1.0.0');
  }, [currentVersion]);

  const handleGithubClick = async () => {
    try {
      await openExternal('https://github.com/ExpTechTW/eq-rts-map');
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const toggleDisplayMode = () => {
    if (onDisplayModeChange) {
      onDisplayModeChange(displayMode === 'waveform' ? 'spectrogram' : 'waveform');
    }
  };

  return (
    <footer className="fixed bottom-3 left-3 z-50">
      <div className="bg-background/90 backdrop-blur-sm border border-border/50 rounded-md px-1.5 py-1.5 shadow-md flex items-center gap-1.5 transition-all duration-200">
        <p className="text-[10px] text-muted-foreground font-medium pl-1">
          {version}
        </p>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-5 w-5 hover:bg-accent/50 transition-colors"
          title={collapsed ? '展開' : '收合'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        {!collapsed && (
          <>
            {onDisplayModeChange && (
              <>
                <div className="w-px h-3 bg-border/60" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDisplayMode}
                  className="h-5 w-5 hover:bg-accent/50 transition-colors text-blue-400"
                  title={displayMode === 'waveform' ? '切換到頻譜圖' : '切換到波形圖'}
                >
                  {displayMode === 'waveform' ? (
                    <Activity className="h-3 w-3" />
                  ) : (
                    <AudioWaveform className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}

            <div className="w-px h-3 bg-border/60" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGithubClick}
              className="h-5 w-5 hover:bg-accent/50 transition-colors"
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
