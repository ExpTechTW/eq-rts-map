// RTS Data Worker - 專注於 HTTP 請求和 timeout
async function fetchRTSData(replayTime) {
  let url;
  if (replayTime === 0) {
    url = 'https://lb.exptech.dev/api/v1/trem/rts';
  } else {
    url = `https://api-1.exptech.dev/api/v2/trem/rts/${replayTime}`;
  }

  // 設置 3 秒 timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return {
      time: data.time || Date.now(),
      station: data.station || {},
      int: data.int || [],
      box: data.box || {},
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 處理站點資訊請求
async function fetchStationInfo() {
  const response = await fetch('https://api-1.exptech.dev/api/v1/trem/station');
  const data = await response.json();
  const stationMap = new Map();

  for (const [uuid, station] of Object.entries(data)) {
    stationMap.set(uuid, station);
  }

  return stationMap;
}

// 監聽主線程消息
self.onmessage = async function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'FETCH_RTS_DATA':
        const rtsData = await fetchRTSData(data.replayTime);
        self.postMessage({
          type: 'RTS_DATA_SUCCESS',
          data: rtsData,
        });
        break;
      
      case 'FETCH_STATION_INFO':
        const stationMap = await fetchStationInfo();
        // 將 Map 轉換為普通物件以便傳送
        const stationMapObj = {};
        for (const [key, value] of stationMap) {
          stationMapObj[key] = value;
        }
        self.postMessage({
          type: 'STATION_INFO_SUCCESS',
          data: stationMapObj,
        });
        break;
      
      default:
        self.postMessage({
          type: 'ERROR',
          error: 'Unknown message type',
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message,
    });
  }
};
