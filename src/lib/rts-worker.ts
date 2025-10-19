import { ProcessedStationData, StationInfo, RTSResponse, createStationGeoJSON } from './rts';

export interface WorkerMessage {
  type: string;
  data?: any;
  error?: string;
}

export class RTSWorkerManager {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private errorHandlers: Map<string, (error: string) => void> = new Map();
  private replayTime = 0;
  private stationMapCache: Map<string, StationInfo> | null = null;
  private stationMapLastFetch = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('/rts-worker.js');
      
      this.worker.onmessage = (e) => {
        const { type, data, error } = e.data;
        
        if (error) {
          const errorHandler = this.errorHandlers.get(type);
          if (errorHandler) {
            errorHandler(error);
          }
        } else {
          const messageHandler = this.messageHandlers.get(type);
          if (messageHandler) {
            messageHandler(data);
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.errorHandlers.forEach((handler) => {
          handler(error.message || 'Unknown worker error');
        });
      };
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  onError(type: string, handler: (error: string) => void) {
    this.errorHandlers.set(type, handler);
  }

  postMessage(type: string, data?: any) {
    if (this.worker) {
      this.worker.postMessage({ type, data });
    }
  }

  async fetchRTSData(): Promise<RTSResponse> {
    return new Promise((resolve, reject) => {
      const successHandler = (data: any) => {
        this.messageHandlers.delete('RTS_DATA_SUCCESS');
        this.errorHandlers.delete('DATA_ERROR');
        
        resolve({
          time: data.time,
          station: data.station,
          int: data.int,
          box: data.box,
        });
      };

      const errorHandler = (error: string) => {
        this.messageHandlers.delete('RTS_DATA_SUCCESS');
        this.errorHandlers.delete('DATA_ERROR');
        reject(new Error(error));
      };

      this.onMessage('RTS_DATA_SUCCESS', successHandler);
      this.onError('DATA_ERROR', errorHandler);

      this.postMessage('FETCH_RTS_DATA', { replayTime: this.replayTime });
      
      if (this.replayTime !== 0) {
        this.replayTime += 1;
      }
    });
  }

  async fetchAndProcessStationData(): Promise<ProcessedStationData> {
    const [stationMap, rtsResponse] = await Promise.all([
      this.fetchStationInfo(),
      this.fetchRTSData(),
    ]);

    const geojson = createStationGeoJSON(stationMap, rtsResponse.station);

    return {
      geojson,
      time: rtsResponse.time,
      int: rtsResponse.int,
      box: rtsResponse.box,
    };
  }

  async fetchStationInfo(): Promise<Map<string, StationInfo>> {
    const now = Date.now();
    const shouldRefresh = !this.stationMapCache || (now - this.stationMapLastFetch) > 600000; // 600秒 = 10分鐘

    if (shouldRefresh) {
      const response = await fetch('https://api-1.exptech.dev/api/v1/trem/station');
      const data = await response.json();
      const stationMap = new Map<string, StationInfo>();

      for (const [uuid, station] of Object.entries(data)) {
        stationMap.set(uuid, station as StationInfo);
      }

      this.stationMapCache = stationMap;
      this.stationMapLastFetch = now;
    }

    return this.stationMapCache!;
  }

  setReplayTime(replayTime: number) {
    this.replayTime = replayTime;
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.messageHandlers.clear();
    this.errorHandlers.clear();
  }
}
