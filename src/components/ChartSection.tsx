'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { WaveformWebSocket, type WaveformData } from '@/lib/websocket';
import { ChartWorkerManager, type StationConfig } from '@/lib/chart-worker';
import { WaveformRenderer } from '@/lib/waveform/WaveformRenderer';
import type { WaveformRenderData, ChannelConfig } from '@/lib/waveform/types';
import SpectrogramSection from './SpectrogramSection';
import { useAuth } from '@/contexts/AuthContext';

const DISPLAY_DURATION = 60;
const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const TOTAL_HEIGHT = 630;
const LABEL_OFFSETS = [30, 45, 50, 60, 70];

type DisplayMode = 'waveform' | 'spectrogram';

const FALLBACK_WS_TOKEN = '48f185d188288f5e613e5878e0c25e462543dbec8c1993b0b16a4d758e6ffd68';

const ChartSection = React.memo(({ displayMode = 'waveform' }: { displayMode?: DisplayMode }) => {
  const { resolvedTheme } = useTheme();
  const { accessToken } = useAuth();
  const token = accessToken ?? FALLBACK_WS_TOKEN;
  const [waveformData, setWaveformData] = useState<Record<number, (number | null)[]>>({});
  const [stationConfigs, setStationConfigs] = useState<Record<number, StationConfig>>({});
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);
  const [renderData, setRenderData] = useState<WaveformRenderData | null>(null);

  const buffers = useRef<Record<number, number[]>>({});
  const configs = useRef<Record<number, StationConfig>>({});
  const worker = useRef<ChartWorkerManager | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<WaveformRenderer | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    renderer.current = new WaveformRenderer();
    return () => { renderer.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (displayMode !== 'waveform' || !canvas.current || !renderer.current || !renderData) return;
    renderer.current.render(canvas.current, renderData, resolvedTheme === 'dark' ? 'dark' : 'light');
  }, [renderData, resolvedTheme, displayMode]);

  useEffect(() => {
    mounted.current = true;
    worker.current = new ChartWorkerManager();
    worker.current.generateChannelConfigs().then(c => mounted.current && setChannelConfigs(c));

    STATION_IDS.forEach(id => { buffers.current[id] = []; });

    const ws = new WaveformWebSocket({
      wsUrl: 'ws://lb.exptech.dev/ws',
      token,
      topics: ['websocket.trem.rtw.v1'],
      stationIds: STATION_IDS
    });

    ws.onWaveform((data: WaveformData) => {
      if (!mounted.current) return;
      if (!configs.current[data.id]) {
        const cfg: StationConfig = {
          sampleRate: data.sampleRate,
          dataLength: data.sampleRate * DISPLAY_DURATION,
          scale: data.precision === 2 ? 20 : 15000,
        };
        configs.current[data.id] = cfg;
        setStationConfigs(prev => ({ ...prev, [data.id]: cfg }));
      }
      const buf = buffers.current[data.id] ??= [];
      const max = configs.current[data.id]?.sampleRate * 10 || 1000;
      buf.push(...data.X);
      if (buf.length > max) buf.splice(0, buf.length - max);
    });

    ws.connect().catch(() => {});

    const interval = setInterval(() => {
      if (!mounted.current || !worker.current) return;

      setWaveformData(prev => {
        const next: Record<number, (number | null)[]> = {};
        for (const id of STATION_IDS) {
          const cfg = configs.current[id];
          if (!cfg) { next[id] = prev[id] || []; continue; }
          const cur = prev[id] || Array(cfg.dataLength).fill(null);
          const buf = buffers.current[id] || [];
          const inc = buf.length > 0 ? buf.splice(0) : Array(cfg.sampleRate).fill(null);
          const combined = [...cur, ...inc];
          while (combined.length > cfg.dataLength) combined.shift();
          next[id] = combined;
        }
        worker.current?.processChartDataForCanvas(next, configs.current)
          .then(d => mounted.current && setRenderData(d)).catch(() => {});
        return next;
      });
    }, 1000);

    return () => {
      mounted.current = false;
      ws.disconnect();
      clearInterval(interval);
      worker.current?.destroy();
    };
  }, []);

  return (
    <div className="w-1/2 h-full bg-gray-50 dark:bg-gray-900 relative">
      {displayMode === 'waveform' ? (
        <>
          <div className="absolute left-2 top-0 bottom-0 z-10 pointer-events-none">
            {channelConfigs.map((cfg, i) => {
              const top = ((TOTAL_HEIGHT - (cfg.baseline + LABEL_OFFSETS[i])) / TOTAL_HEIGHT) * 100;
              const id = STATION_IDS[i];
              const isSE = stationConfigs[id]?.scale === 20;
              return (
                <div key={i} className="absolute -translate-y-1/2" style={{ top: `${top}%` }}>
                  <div className="text-xs font-semibold px-2 py-1 rounded bg-black text-white border border-white/20">
                    <div>{id}</div>
                    {stationConfigs[id] && (
                      <div className="text-[10px] font-medium" style={{ color: isSE ? '#3b82f6' : '#eab308' }}>
                        {isSE ? 'SE-Net' : 'MS-Net'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
        </>
      ) : (
        <SpectrogramSection waveformData={waveformData} stationConfigs={stationConfigs} />
      )}
    </div>
  );
});

ChartSection.displayName = 'ChartSection';
export default ChartSection;
