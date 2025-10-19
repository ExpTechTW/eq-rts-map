let latestDataTime = 0;
let REPLAY_TIME = 1759881140;

async function fetchRTSData() {
  let url;
  if (REPLAY_TIME === 0) {
    url = 'https://lb.exptech.dev/api/v1/trem/rts';
  } else {
    url = `https://api-1.exptech.dev/api/v2/trem/rts/${REPLAY_TIME}`;
    REPLAY_TIME += 1;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    const responseTime = data.time || Date.now();

    if (responseTime <= latestDataTime) {
      throw new Error('Data is older than existing data');
    }

    latestDataTime = responseTime;

    return {
      time: responseTime,
      station: data.station || {},
      int: data.int || [],
      box: data.box || {},
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchStationInfo() {
  const response = await fetch('https://api-1.exptech.dev/api/v1/trem/station');
  const data = await response.json();
  const stationMap = new Map();

  for (const [uuid, station] of Object.entries(data)) {
    stationMap.set(uuid, station);
  }

  return stationMap;
}

async function fetchAndProcessStationData() {
  try {
    const [stationMap, rtsResponse] = await Promise.all([
      fetchStationInfo(),
      fetchRTSData(),
    ]);

    const stationMapObj = {};
    for (const [key, value] of stationMap) {
      stationMapObj[key] = value;
    }

    return {
      stationMap: stationMapObj,
      rtsResponse,
    };
  } catch (error) {
    throw error;
  }
}

self.onmessage = async function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'FETCH_DATA':
        const result = await fetchAndProcessStationData();
        self.postMessage({
          type: 'DATA_SUCCESS',
          data: result,
        });
        break;
      
      case 'SET_REPLAY_TIME':
        REPLAY_TIME = data.replayTime;
        self.postMessage({
          type: 'REPLAY_TIME_SET',
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
      type: 'DATA_ERROR',
      error: error.message,
    });
  }
};
