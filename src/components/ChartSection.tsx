'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { WaveformWebSocket, type WaveformData } from '@/lib/websocket';
import { ChartWorkerManager, type StationConfig } from '@/lib/chart-worker';
import { WaveformRenderer } from '@/lib/waveform/WaveformRenderer';
import type { WaveformRenderData, ChannelConfig } from '@/lib/waveform/types';
import SpectrogramSection from './SpectrogramSection';

const DISPLAY_DURATION = 60;
const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const TOTAL_HEIGHT = 630;
const CHANNEL_LABEL_OFFSETS = [30, 45, 50, 60, 70];

type DisplayMode = 'waveform' | 'spectrogram';

interface ChartSectionProps {
  displayMode?: DisplayMode;
}

const ChartSection = React.memo(({ displayMode = 'waveform' }: ChartSectionProps) => {
  const { resolvedTheme } = useTheme();
  const [waveformData, setWaveformData] = useState<Record<number, (number | null)[]>>({});
  const [stationConfigs, setStationConfigs] = useState<Record<number, StationConfig>>({});
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);
  const [renderData, setRenderData] = useState<WaveformRenderData | null>(null);

  const waveformBuffersRef = useRef<Record<number, number[]>>({});
  const stationConfigsRef = useRef<Record<number, StationConfig>>({});
  const chartWorkerRef = useRef<ChartWorkerManager | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WaveformRenderer | null>(null);
  const isMountedRef = useRef(true);

  // Initialize renderer
  useEffect(() => {
    rendererRef.current = new WaveformRenderer();
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Render waveform when data or theme changes
  useEffect(() => {
    if (displayMode !== 'waveform') return;
    if (!canvasRef.current || !rendererRef.current || !renderData) return;

    rendererRef.current.render(
      canvasRef.current,
      renderData,
      resolvedTheme === 'dark' ? 'dark' : 'light'
    );
  }, [renderData, resolvedTheme, displayMode]);

  // WebSocket and data management
  useEffect(() => {
    isMountedRef.current = true;
    chartWorkerRef.current = new ChartWorkerManager();
    chartWorkerRef.current.generateChannelConfigs().then(configs => {
      if (isMountedRef.current) setChannelConfigs(configs);
    });

    STATION_IDS.forEach(id => { waveformBuffersRef.current[id] = []; });

    const ws = new WaveformWebSocket({
      wsUrl: 'ws://lb.exptech.dev/ws',
      token: '48f185d188288f5e613e5878e0c25e462543dbec8c1993b0b16a4d758e6ffd68',
      topics: ['websocket.trem.rtw.v1'],
      stationIds: STATION_IDS
    });

    ws.onWaveform((data: WaveformData) => {
      if (!isMountedRef.current) return;

      if (!stationConfigsRef.current[data.id]) {
        const config: StationConfig = {
          sampleRate: data.sampleRate,
          dataLength: data.sampleRate * DISPLAY_DURATION,
          scale: data.precision === 2 ? 20 : 15000,
        };
        stationConfigsRef.current[data.id] = config;
        if (isMountedRef.current) setStationConfigs(prev => ({ ...prev, [data.id]: config }));
      }

      const buffer = waveformBuffersRef.current[data.id] ??= [];
      const maxSize = stationConfigsRef.current[data.id]?.sampleRate * 10 || 1000;
      buffer.push(...data.X);
      if (buffer.length > maxSize) buffer.splice(0, buffer.length - maxSize);
    });

    ws.connect().catch(() => {});

    const updateInterval = setInterval(() => {
      if (!isMountedRef.current || !chartWorkerRef.current) return;

      setWaveformData(prev => {
        if (!isMountedRef.current) return prev;

        const newData: Record<number, (number | null)[]> = {};

        STATION_IDS.forEach(stationId => {
          const config = stationConfigsRef.current[stationId];
          if (!config) {
            newData[stationId] = prev[stationId] || [];
            return;
          }

          const { dataLength, sampleRate } = config;
          const currentData = prev[stationId] || Array(dataLength).fill(null);
          const buffer = waveformBuffersRef.current[stationId] || [];
          const incoming = buffer.length > 0 ? buffer.splice(0) : Array(sampleRate).fill(null);

          const combined = [...currentData, ...incoming];
          while (combined.length > dataLength) combined.shift();
          newData[stationId] = combined;
        });

        // Use Canvas-specific processing
        chartWorkerRef.current?.processChartDataForCanvas(newData, stationConfigsRef.current)
          .then(data => { if (isMountedRef.current) setRenderData(data); })
          .catch(() => {});

        return newData;
      });
    }, 1000);

    return () => {
      isMountedRef.current = false;
      ws.disconnect();
      clearInterval(updateInterval);
      chartWorkerRef.current?.destroy();
      chartWorkerRef.current = null;
    };
  }, []);

  const renderStationLabel = useCallback((config: ChannelConfig, index: number) => {
    const topPct = ((TOTAL_HEIGHT - (config.baseline + CHANNEL_LABEL_OFFSETS[index])) / TOTAL_HEIGHT) * 100;
    const stationId = STATION_IDS[index];
    const stationConfig = stationConfigs[stationId];
    const isSENet = stationConfig?.scale === 20;

    return (
      <div key={index} className="absolute -translate-y-1/2" style={{ top: `${topPct}%` }}>
        <div className="text-xs font-semibold px-2 py-1 rounded" style={{ color: '#fff', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div>{stationId}</div>
          {stationConfig && (
            <div className="text-[10px] font-medium" style={{ color: isSENet ? '#3b82f6' : '#eab308' }}>
              {isSENet ? 'SE-Net' : 'MS-Net'}
            </div>
          )}
        </div>
      </div>
    );
  }, [stationConfigs]);

  return (
    <div className="w-1/2 h-full bg-gray-50 dark:bg-gray-900 relative">
      {displayMode === 'waveform' ? (
        <>
          <div className="absolute left-2 top-0 bottom-0 z-10 pointer-events-none">
            {channelConfigs.map(renderStationLabel)}
          </div>
          <div className="absolute inset-0">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
            />
          </div>
        </>
      ) : (
        <SpectrogramSection waveformData={waveformData} stationConfigs={stationConfigs} />
      )}
    </div>
  );
});

ChartSection.displayName = 'ChartSection';

export default ChartSection;
