'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Spectrogram } from '@/lib/spectrogram';

const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const LEFT_AXIS_WIDTH = 20;
const BOTTOM_AXIS_HEIGHT = 24;
const TIME_LABELS = [60, 50, 40, 30, 20, 10, 0];

type StationConfig = { sampleRate: number; dataLength: number; scale: number };

interface Props {
  waveformData: Record<number, (number | null)[]>;
  stationConfigs: Record<number, StationConfig>;
}

const SpectrogramSection = React.memo(({ waveformData, stationConfigs }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const spectrograms = useRef<Map<number, Spectrogram>>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => () => {
    spectrograms.current.forEach(s => s.dispose());
    spectrograms.current.clear();
  }, []);

  const specW = size.width - LEFT_AXIS_WIDTH;
  const specH = size.height - BOTTOM_AXIS_HEIGHT;
  const chH = specH / STATION_IDS.length;

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;

    STATION_IDS.forEach((id, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;

      const cfg = stationConfigs[id];
      const data = waveformData[id];

      if (!cfg || !data?.length) {
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        return;
      }

      const { sampleRate } = cfg;
      const processed = data.map(v => v ?? 0);
      if (processed.length < 64) return;

      let spec = spectrograms.current.get(id);
      if (!spec || spec.getSampleRate() !== sampleRate) {
        spec?.dispose();
        spec = new Spectrogram({
          sampleRate, windowSize: 64, overlap: 48, fftSize: 128,
          windowType: 'hann', minDb: -60, maxDb: 0,
        });
        spec.setColormap('jet');
        spectrograms.current.set(id, spec);
      }

      const floatData = new Float32Array(processed);
      spec.setData(floatData);
      spec.render({
        canvas, width: specW, height: chH,
        timeRange: [0, floatData.length / sampleRate],
        freqRange: [0, sampleRate / 2],
      });
    });
  }, [waveformData, stationConfigs, size, specW, chH]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-gray-900">
      <div className="flex flex-1" style={{ height: `calc(100% - ${BOTTOM_AXIS_HEIGHT}px)` }}>
        <div className="flex flex-col" style={{ width: LEFT_AXIS_WIDTH }}>
          {STATION_IDS.map(id => {
            const freq = stationConfigs[id]?.sampleRate / 2 || 25;
            return (
              <div key={id} className="flex-1 flex flex-col justify-between text-[9px] text-gray-400 pr-1">
                <span className="text-right">{freq}</span>
                <span className="text-right">{Math.round(freq / 2)}</span>
                <span className="text-right">0</span>
              </div>
            );
          })}
        </div>
        <div className="flex-1 flex flex-col">
          {STATION_IDS.map((id, i) => {
            const isSE = stationConfigs[id]?.scale === 20;
            return (
              <div key={id} className="relative flex-1">
                <canvas ref={el => { canvasRefs.current[i] = el; }} width={specW || 800} height={chH || 100} className="w-full h-full" />
                <div className="absolute left-2 top-1 z-10">
                  <div className="text-xs font-semibold px-2 py-1 rounded bg-black text-white border border-white/20">
                    <div>{id}</div>
                    {stationConfigs[id] && (
                      <div className="text-[10px] font-medium" style={{ color: isSE ? '#3b82f6' : '#eab308' }}>
                        {isSE ? 'SE-Net' : 'MS-Net'}
                      </div>
                    )}
                  </div>
                </div>
                {i < STATION_IDS.length - 1 && <div className="absolute bottom-0 inset-x-0 h-px bg-white z-10" />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex" style={{ height: BOTTOM_AXIS_HEIGHT }}>
        <div style={{ width: LEFT_AXIS_WIDTH }} className="flex items-center justify-end pr-1 text-[9px] text-gray-500">Hz</div>
        <div className="flex-1 relative border-t border-gray-600">
          <div className="absolute inset-0 flex justify-between items-center px-1 text-[10px] text-gray-400">
            {TIME_LABELS.map(s => <span key={s}>{s}s</span>)}
          </div>
        </div>
      </div>
    </div>
  );
});

SpectrogramSection.displayName = 'SpectrogramSection';
export default SpectrogramSection;
