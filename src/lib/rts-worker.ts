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
  
  // 主線程狀態管理
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
        // 通知所有錯誤處理器
        this.errorHandlers.forEach((handler) => {
          handler(error.message || 'Unknown worker error');
        });
      };
    }
  }

  // 註冊消息處理器
  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  // 註冊錯誤處理器
  onError(type: string, handler: (error: string) => void) {
    this.errorHandlers.set(type, handler);
  }

  // 發送消息到 Worker
  postMessage(type: string, data?: any) {
    if (this.worker) {
      this.worker.postMessage({ type, data });
    }
  }

  // 請求 RTS 數據
  fetchRTSData(): Promise<RTSResponse> {
    return new Promise((resolve, reject) => {
      const successHandler = (data: RTSResponse) => {
        this.messageHandlers.delete('RTS_DATA_SUCCESS');
        this.errorHandlers.delete('ERROR');
        resolve(data);
      };

      const errorHandler = (error: string) => {
        this.messageHandlers.delete('RTS_DATA_SUCCESS');
        this.errorHandlers.delete('ERROR');
        reject(new Error(error));
      };

      this.onMessage('RTS_DATA_SUCCESS', successHandler);
      this.onError('ERROR', errorHandler);

      this.postMessage('FETCH_RTS_DATA', { replayTime: this.replayTime });
      
      // 更新重播時間
      if (this.replayTime !== 0) {
        this.replayTime += 1;
      }
    });
  }

  // 請求站點資訊（緩存）
  fetchStationInfo(): Promise<Map<string, StationInfo>> {
    return new Promise((resolve, reject) => {
      // 如果有緩存，直接返回
      if (this.stationMapCache) {
        resolve(this.stationMapCache);
        return;
      }

      const successHandler = (data: any) => {
        this.messageHandlers.delete('STATION_INFO_SUCCESS');
        this.errorHandlers.delete('ERROR');
        
        // 轉換為 Map 並緩存
        const stationMap = new Map<string, StationInfo>();
        for (const [key, value] of Object.entries(data)) {
          stationMap.set(key, value as StationInfo);
        }
        this.stationMapCache = stationMap;
        resolve(stationMap);
      };

      const errorHandler = (error: string) => {
        this.messageHandlers.delete('STATION_INFO_SUCCESS');
        this.errorHandlers.delete('ERROR');
        reject(new Error(error));
      };

      this.onMessage('STATION_INFO_SUCCESS', successHandler);
      this.onError('ERROR', errorHandler);

      this.postMessage('FETCH_STATION_INFO');
    });
  }

  // 檢查數據時間
  isDataNewer(responseTime: number): boolean {
    return responseTime > this.latestDataTime;
  }

  // 更新最新時間
  updateLatestTime(time: number) {
    this.latestDataTime = time;
  }

  // 設置重播時間
  setReplayTime(replayTime: number) {
    this.replayTime = replayTime;
  }

  // 完整的數據請求（包含時間檢查）
  async fetchAndProcessStationData(): Promise<ProcessedStationData> {
    try {
      // 並行請求站點資訊和 RTS 數據
      const [stationMap, rtsResponse] = await Promise.all([
        this.fetchStationInfo(),
        this.fetchRTSData(),
      ]);

      // 檢查數據時間
      if (!this.isDataNewer(rtsResponse.time)) {
        throw new Error('Data is older than existing data');
      }

      // 更新最新時間
      this.updateLatestTime(rtsResponse.time);

      // 創建 GeoJSON
      const geojson = createStationGeoJSON(stationMap, rtsResponse.station);

      return {
        geojson,
        time: rtsResponse.time,
        int: rtsResponse.int,
        box: rtsResponse.box,
      };
    } catch (error) {
      throw error;
    }
  }

  // 清理 Worker
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.messageHandlers.clear();
    this.errorHandlers.clear();
  }
}
