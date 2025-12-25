import type { WaveformRenderData, ChannelConfig } from './waveform/types';

export type StationConfig = {
  sampleRate: number;
  dataLength: number;
  scale: number;
};

export class ChartWorkerManager {
  private worker: Worker | null = null;
  private handlers = new Map<string, (data: any) => void>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('/chart-worker.js');
      this.worker.onmessage = (e) => {
        const handler = this.handlers.get(e.data.type);
        if (handler) handler(e.data.data);
      };
    }
  }

  private request<T>(type: string, successType: string, data?: any): Promise<T> {
    return new Promise((resolve) => {
      this.handlers.set(successType, (result) => {
        this.handlers.delete(successType);
        resolve(result);
      });
      this.worker?.postMessage({ type, data });
    });
  }

  generateChannelConfigs(): Promise<ChannelConfig[]> {
    return this.request('GENERATE_CHANNEL_CONFIGS', 'CHANNEL_CONFIGS_SUCCESS');
  }

  processChartDataForCanvas(
    waveformData: Record<number, (number | null)[]>,
    stationConfigs: Record<number, StationConfig>
  ): Promise<WaveformRenderData> {
    return this.request('PROCESS_CHART_DATA_CANVAS', 'CHART_DATA_CANVAS_SUCCESS', { waveformData, stationConfigs });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.handlers.clear();
  }
}
