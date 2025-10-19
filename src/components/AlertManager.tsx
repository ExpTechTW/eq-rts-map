'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRTS } from '@/contexts/RTSContext';

const AlertManager = React.memo(() => {
  const { data } = useRTS();
  const [hasAlert, setHasAlert] = useState<boolean>(false);
  const [previousHasAlert, setPreviousHasAlert] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/audios/alarm.wav');
  }, []);

  useEffect(() => {
    if (!data) {
      setPreviousHasAlert(hasAlert);
      setHasAlert(false);
      return;
    }

    const shouldAlert = data.box && Object.keys(data.box).length > 0;
    setPreviousHasAlert(hasAlert);
    setHasAlert(shouldAlert);
  }, [data, hasAlert]);

  useEffect(() => {
    if (!hasAlert) {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }

    const isFirstAlert = !previousHasAlert && hasAlert;
    
    const playAlarmAndFocus = () => {
      audioRef.current?.play().catch(() => {});
      
      if (isFirstAlert && window.electronAPI) {
        (window.electronAPI as any).showWindow().catch(() => {});
      }
    };

    playAlarmAndFocus();
    const interval = setInterval(() => {
      audioRef.current?.play().catch(() => {});
    }, 3000);

    return () => {
      clearInterval(interval);
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };
  }, [hasAlert, previousHasAlert]);

  return null;
});

AlertManager.displayName = 'AlertManager';

export default AlertManager;
