'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Spectrogram } from '@/lib/spectrogram';

const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const DISPLAY_DURATION = 60;
const LEFT_AXIS_WIDTH = 20;
const BOTTOM_AXIS_HEIGHT = 24;

interface SpectrogramSectionProps {
  waveformData: Record<number, (number | null)[]>;
  stationConfigs: Record<number, { sampleRate: number; dataLength: number; scale: number }>;
}

const SpectrogramSection = React.memo(({ waveformData, stationConfigs }: SpectrogramSectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const spectrogramsRef = useRef<Map<number, Spectrogram>>(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });


  const getMaxFreq = useCallback((stationId: number) => {
    const config = stationConfigs[stationId];
    return config ? config.sampleRate / 2 : 25;
  }, [stationConfigs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      spectrogramsRef.current.forEach(spec => spec.dispose());
      spectrogramsRef.current.clear();
    };
  }, []);

  const renderSpectrograms = useCallback(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const spectrogramWidth = containerSize.width - LEFT_AXIS_WIDTH;
    const spectrogramAreaHeight = containerSize.height - BOTTOM_AXIS_HEIGHT;
    const channelHeight = spectrogramAreaHeight / STATION_IDS.length;

    STATION_IDS.forEach((stationId, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;

      const config = stationConfigs[stationId];
      const data = waveformData[stationId];

      if (!config || !data || data.length === 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const sampleRate = config.sampleRate;
      const processedData = data.map(v => v === null ? 0 : v);

      if (processedData.length < 64) return;

      let spectrogram = spectrogramsRef.current.get(stationId);

      if (!spectrogram || spectrogram.getSampleRate() !== sampleRate) {
        spectrogram?.dispose();
        spectrogram = new Spectrogram({
          sampleRate,
          windowSize: 64,
          overlap: 48,
          fftSize: 128,
          windowType: 'hann',
          minDb: -60,
          maxDb: 0,
        });
        spectrogram.setColormap('jet');
        spectrogramsRef.current.set(stationId, spectrogram);
      }

      const floatData = new Float32Array(processedData);
      spectrogram.setData(floatData);

      spectrogram.render({
        canvas,
        width: spectrogramWidth,
        height: channelHeight,
        timeRange: [0, floatData.length / sampleRate],
        freqRange: [0, sampleRate / 2],
      });
    });
  }, [waveformData, stationConfigs, containerSize]);

  useEffect(() => {
    renderSpectrograms();
  }, [renderSpectrograms]);

  const spectrogramAreaHeight = containerSize.height - BOTTOM_AXIS_HEIGHT;
  const channelHeight = spectrogramAreaHeight / STATION_IDS.length;
  const spectrogramWidth = containerSize.width - LEFT_AXIS_WIDTH;

  const timeLabels = useMemo(() => {
    const labels = [];
    for (let i = DISPLAY_DURATION; i >= 0; i -= 10) {
      labels.push(i);
    }
    return labels;
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-gray-900">
      <div className="flex flex-1" style={{ height: `calc(100% - ${BOTTOM_AXIS_HEIGHT}px)` }}>
        {/* Left Hz axis */}
        <div className="flex flex-col" style={{ width: LEFT_AXIS_WIDTH }}>
          {STATION_IDS.map((stationId) => {
            const maxFreq = getMaxFreq(stationId);
            return (
              <div key={stationId} className="relative flex flex-col justify-between text-[9px] text-gray-400 pr-1" style={{ height: `${100 / STATION_IDS.length}%` }}>
                <span className="text-right">{maxFreq}</span>
                <span className="text-right">{Math.round(maxFreq / 2)}</span>
                <span className="text-right">0</span>
              </div>
            );
          })}
        </div>

        {/* Spectrogram area */}
        <div className="flex-1 flex flex-col">
          {STATION_IDS.map((stationId, index) => {
            const config = stationConfigs[stationId];
            const isSENet = config?.scale === 20;

            return (
              <div key={stationId} className="relative" style={{ height: `${100 / STATION_IDS.length}%` }}>
                <canvas
                  ref={el => { canvasRefs.current[index] = el; }}
                  width={spectrogramWidth || 800}
                  height={channelHeight || 100}
                  style={{ width: '100%', height: '100%' }}
                />
                <div className="absolute left-2 top-1 z-10">
                  <div className="text-xs font-semibold px-2 py-1 rounded" style={{ color: '#fff', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div>{stationId}</div>
                    {config && <div className="text-[10px] font-medium" style={{ color: isSENet ? '#3b82f6' : '#eab308' }}>{isSENet ? 'SE-Net' : 'MS-Net'}</div>}
                  </div>
                </div>
                {index < STATION_IDS.length - 1 && <div className="absolute bottom-0 left-0 right-0 h-px bg-white z-10" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom time axis */}
      <div className="flex" style={{ height: BOTTOM_AXIS_HEIGHT }}>
        <div style={{ width: LEFT_AXIS_WIDTH }} className="flex items-center justify-end pr-1 text-[9px] text-gray-500">Hz</div>
        <div className="flex-1 relative border-t border-gray-600">
          <div className="absolute inset-0 flex justify-between items-center px-1 text-[10px] text-gray-400">
            {timeLabels.map(sec => (
              <span key={sec}>{sec}s</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

SpectrogramSection.displayName = 'SpectrogramSection';

export default SpectrogramSection;
