'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { WaveformWebSocket, type WaveformData } from '@/lib/websocket';
import { ChartWorkerManager, type ChartData } from '@/lib/chart-worker';
import SpectrogramSection from './SpectrogramSection';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const DISPLAY_DURATION = 60;
const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const CHART_LENGTH = 50 * DISPLAY_DURATION;
const TOTAL_HEIGHT = 630;
const CHANNEL_LABEL_OFFSETS = [30, 45, 50, 60, 70];

type DisplayMode = 'waveform' | 'spectrogram';

interface ChartSectionProps {
  displayMode?: DisplayMode;
}

const ChartSection = React.memo(({ displayMode = 'waveform' }: ChartSectionProps) => {
  const { theme } = useTheme();
  const [waveformData, setWaveformData] = useState<Record<number, (number | null)[]>>({});
  const [stationConfigs, setStationConfigs] = useState<Record<number, { sampleRate: number; dataLength: number; scale: number }>>({});
  const [chartData, setChartData] = useState<ChartData>({ labels: [], datasets: [] });
  const prevChartDataRef = useRef<ChartData | null>(null);
  const [channelConfigs, setChannelConfigs] = useState<Array<{ baseline: number; color: string }>>([]);
  const waveformBuffersRef = useRef<Record<number, number[]>>({});
  const stationConfigsRef = useRef<Record<number, { sampleRate: number; dataLength: number; scale: number }>>({});
  const chartWorkerRef = useRef<ChartWorkerManager | null>(null);
  const chartRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

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
        const config = {
          sampleRate: data.sampleRate,
          dataLength: data.sampleRate * DISPLAY_DURATION,
          scale: data.precision === 2 ? 20 : 15000,
        };
        stationConfigsRef.current[data.id] = config;
        if (isMountedRef.current) setStationConfigs(prev => ({ ...prev, [data.id]: config }));
      }

      if (!waveformBuffersRef.current[data.id]) waveformBuffersRef.current[data.id] = [];

      const config = stationConfigsRef.current[data.id];
      const maxBufferSize = config ? config.sampleRate * 10 : 1000;
      const buffer = waveformBuffersRef.current[data.id];
      buffer.push(...data.X);
      if (buffer.length > maxBufferSize) buffer.splice(0, buffer.length - maxBufferSize);
    });

    ws.connect().catch(() => {});

    const updateInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      if (chartWorkerRef.current && isMountedRef.current) {
        setWaveformData(prev => {
          if (!isMountedRef.current) return prev;

          const newData: Record<number, (number | null)[]> = {};

          STATION_IDS.forEach(stationId => {
            const config = stationConfigsRef.current[stationId];
            if (!config) {
              newData[stationId] = prev[stationId] || [];
              return;
            }

            const maxLength = config.dataLength;
            const currentData = prev[stationId] || Array(maxLength).fill(0);
            const buffer = waveformBuffersRef.current[stationId] || [];

            if (buffer.length > 0) {
              const bufferData = buffer.splice(0);
              const newStationData = [...currentData, ...bufferData];
              while (newStationData.length > maxLength) newStationData.shift();
              newData[stationId] = newStationData;
            } else {
              // 沒有新數據時填入 0 並繼續滾動
              const samplesPerSecond = config.sampleRate;
              const zeros = Array(samplesPerSecond).fill(0);
              const newStationData = [...currentData, ...zeros];
              while (newStationData.length > maxLength) newStationData.shift();
              newData[stationId] = newStationData;
            }
          });

          if (isMountedRef.current && chartWorkerRef.current) {
            chartWorkerRef.current.processChartData(newData, stationConfigsRef.current).then(processedData => {
              if (isMountedRef.current) {
                if (prevChartDataRef.current?.datasets) prevChartDataRef.current.datasets = [];
                prevChartDataRef.current = processedData;
                setChartData(processedData);
              }
            }).catch(() => {});
          }

          return newData;
        });
      }
    }, 1000);

    return () => {
      isMountedRef.current = false;
      ws.disconnect();
      clearInterval(updateInterval);
      waveformBuffersRef.current = {};
      stationConfigsRef.current = {};
      if (chartWorkerRef.current) { chartWorkerRef.current.destroy(); chartWorkerRef.current = null; }
      if (chartRef.current?.getChart?.()) chartRef.current.getChart()?.destroy?.();
      chartRef.current = null;
      prevChartDataRef.current = null;
      setChartData({ labels: [], datasets: [] });
    };
  }, []);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: 0 },
    plugins: { legend: { display: false }, title: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        display: true,
        reverse: false,
        title: { display: true, text: 'Time (seconds ago)', color: theme === 'dark' ? '#9ca3af' : '#6b7280', font: { size: 11 } },
        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280', autoSkip: false, maxRotation: 0, minRotation: 0, font: { size: 10 } },
        grid: {
          color: (ctx: any) => {
            const pos = CHART_LENGTH - ctx.index;
            return pos % 500 === 250 && pos > 0 && pos <= CHART_LENGTH
              ? (theme === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.4)')
              : 'transparent';
          },
          drawOnChartArea: true, lineWidth: 0.5, drawTicks: false,
        },
        border: { display: false },
      },
      y: {
        min: 0, max: TOTAL_HEIGHT, display: false,
        grid: {
          display: true,
          color: (ctx: any) => {
            const isBaseline = channelConfigs.some(c => c.baseline === ctx.tick.value);
            return isBaseline
              ? (theme === 'dark' ? 'rgba(107, 114, 128, 0.4)' : 'rgba(156, 163, 175, 0.4)')
              : (theme === 'dark' ? 'rgba(55, 65, 81, 0.2)' : 'rgba(229, 231, 235, 0.3)');
          },
          lineWidth: (ctx: any) => channelConfigs.some(c => c.baseline === ctx.tick.value) ? 0.8 : 0.3,
        },
        border: { display: false },
      },
    },
  }), [theme, channelConfigs]);

  return (
    <div className="w-1/2 h-full bg-gray-50 dark:bg-gray-900 relative">
      {displayMode === 'waveform' ? (
        <>
          <div className="absolute left-2 top-0 bottom-0 z-10 pointer-events-none">
            {channelConfigs.map((config, index) => {
              const topPct = ((TOTAL_HEIGHT - (config.baseline + CHANNEL_LABEL_OFFSETS[index])) / TOTAL_HEIGHT) * 100;
              const stationId = STATION_IDS[index];
              const stationConfig = stationConfigs[stationId];
              const isSENet = stationConfig?.scale === 20;

              return (
                <div key={index} className="absolute -translate-y-1/2" style={{ top: `${topPct}%` }}>
                  <div className="text-xs font-semibold px-2 py-1 rounded" style={{ color: '#fff', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div>{stationId}</div>
                    {stationConfig && <div className="text-[10px] font-medium" style={{ color: isSENet ? '#3b82f6' : '#eab308' }}>{isSENet ? 'SE-Net' : 'MS-Net'}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute inset-0">
            <Line ref={chartRef} data={chartData} options={chartOptions} />
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
