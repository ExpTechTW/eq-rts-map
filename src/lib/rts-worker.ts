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
  
  private latestDataTime = 0;
  private replayTime = 1759881140;
  private stationMapCache: Map<string, StationInfo> | null = null;

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

  async fetchAndProcessStationData(): Promise<ProcessedStationData> {
    return new Promise((resolve, reject) => {
      const successHandler = (data: any) => {
        this.messageHandlers.delete('DATA_SUCCESS');
        this.errorHandlers.delete('DATA_ERROR');
        
        const stationMap = new Map<string, StationInfo>();
        for (const [key, value] of Object.entries(data.stationMap)) {
          stationMap.set(key, value as StationInfo);
        }

        const geojson = createStationGeoJSON(stationMap, data.rtsResponse.station);

        resolve({
          geojson,
          time: data.rtsResponse.time,
          int: data.rtsResponse.int,
          box: data.rtsResponse.box,
        });
      };

      const errorHandler = (error: string) => {
        this.messageHandlers.delete('DATA_SUCCESS');
        this.errorHandlers.delete('DATA_ERROR');
        reject(new Error(error));
      };

      this.onMessage('DATA_SUCCESS', successHandler);
      this.onError('DATA_ERROR', errorHandler);

      this.postMessage('FETCH_DATA');
    });
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
