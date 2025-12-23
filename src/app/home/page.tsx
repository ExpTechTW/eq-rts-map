'use client';

import React, { useState } from 'react';
import MapSection from '@/components/MapSection';
import ChartSection from '@/components/ChartSection';
import AlertManager from '@/components/AlertManager';
import Footer from '@/components/footer';
import { RTSProvider } from '@/contexts/RTSContext';

type DisplayMode = 'waveform' | 'spectrogram';

export default function Home() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('waveform');

  return (
    <RTSProvider>
      <div className="flex h-screen w-full">
        <AlertManager />
        <MapSection />
        <ChartSection displayMode={displayMode} />
        <Footer displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
      </div>
    </RTSProvider>
  );
}
