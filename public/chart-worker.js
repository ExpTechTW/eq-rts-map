const DISPLAY_DURATION = 60;
const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const CHART_LENGTH = 50 * DISPLAY_DURATION;

const TOTAL_HEIGHT = 630;
const NUM_CHANNELS = 5;
const TOP_BOTTOM_GAP_REDUCTION = 50;
const CHANNEL_LABEL_OFFSETS = [30, 45, 50, 60, 70];

const BASE_GAP = TOTAL_HEIGHT / (NUM_CHANNELS + 1);
const TOP_GAP = BASE_GAP - TOP_BOTTOM_GAP_REDUCTION;
const MIDDLE_GAP_EXTRA = (TOP_BOTTOM_GAP_REDUCTION * 2) / 4;
const MIDDLE_GAP = BASE_GAP + MIDDLE_GAP_EXTRA;

// 顏色生成函數
function generateColorFromId(id) {
  let hash = 0;
  const str = id.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  hash = Math.abs(hash);

  const hue = hash % 360;
  const saturation = 85 + (hash % 15);
  const lightness = 50 + (hash % 10);

  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}

// 時間標籤生成
function generateTimeLabels(length, sampleRate) {
  return Array.from({ length }, (_, i) => {
    const position = length - i;
    const timeInSeconds = position / sampleRate;
    const interval = sampleRate * 10;
    const offset = sampleRate * 5;

    if (position % interval === offset && timeInSeconds > 0 && timeInSeconds <= 60) {
      return timeInSeconds.toString();
    }
    return '';
  });
}

// 生成通道配置
function generateChannelConfigs() {
  return [
    { baseline: TOTAL_HEIGHT - TOP_GAP, color: generateColorFromId(STATION_IDS[0]) },
    { baseline: TOTAL_HEIGHT - TOP_GAP - MIDDLE_GAP, color: generateColorFromId(STATION_IDS[1]) },
    { baseline: TOTAL_HEIGHT - TOP_GAP - (MIDDLE_GAP * 2), color: generateColorFromId(STATION_IDS[2]) },
    { baseline: TOTAL_HEIGHT - TOP_GAP - (MIDDLE_GAP * 3), color: generateColorFromId(STATION_IDS[3]) },
    { baseline: TOTAL_HEIGHT - TOP_GAP - (MIDDLE_GAP * 4), color: generateColorFromId(STATION_IDS[4]) },
  ];
}

// 處理波形數據
function processWaveformData(waveformData, stationConfigs) {
  const channelDataArrays = [];
  const channelConfigs = generateChannelConfigs();

  channelConfigs.forEach((config, index) => {
    let data;

    if (index < STATION_IDS.length) {
      const stationId = STATION_IDS[index];
      const stationConfig = stationConfigs[stationId];

      if (!stationConfig) {
        data = Array(CHART_LENGTH).fill(null);
      } else {
        const stationWaveform = waveformData[stationId] || Array(stationConfig.dataLength).fill(null);

        if (stationConfig.sampleRate === 20) {
          data = [];
          for (let i = 0; i < stationWaveform.length; i++) {
            const value = stationWaveform[i];
            if (value !== null) {
              const scaledValue = (value * stationConfig.scale) + config.baseline;
              data.push(scaledValue);
              data.push(scaledValue);
              if (i % 2 === 0) data.push(scaledValue);
            } else {
              data.push(null);
              data.push(null);
              if (i % 2 === 0) data.push(null);
            }
          }
        } else {
          data = stationWaveform.map(value =>
            value !== null ? (value * stationConfig.scale) + config.baseline : null
          );
        }

        while (data.length < CHART_LENGTH) {
          data.unshift(null);
        }
        while (data.length > CHART_LENGTH) {
          data.shift();
        }
      }
    } else {
      data = Array(CHART_LENGTH).fill(null);
    }

    channelDataArrays.push({ index, data });
  });

  return channelDataArrays;
}

// 計算通道最大值
function calculateChannelMaxValues(channelDataArrays) {
  const channelConfigs = generateChannelConfigs();
  const channelMaxValues = [];

  channelDataArrays.forEach(({index, data}) => {
    const config = channelConfigs[index];
    let maxAbsDeviation = 0;

    data.forEach(value => {
      if (value !== null) {
        const deviation = Math.abs(value - config.baseline);
        maxAbsDeviation = Math.max(maxAbsDeviation, deviation);
      }
    });

    channelMaxValues.push({ index, maxAbsDeviation });
  });

  channelMaxValues.sort((a, b) => a.maxAbsDeviation - b.maxAbsDeviation);

  const indexToOrder = {};
  channelMaxValues.forEach((item, order) => {
    indexToOrder[item.index] = order;
  });

  return indexToOrder;
}

// 生成圖表數據集
function generateChartDatasets(channelDataArrays, indexToOrder) {
  const channelConfigs = generateChannelConfigs();
  const datasets = [];

  channelDataArrays.forEach(({index, data}) => {
    const config = channelConfigs[index];
    const orderRank = indexToOrder[index] || 0;
    const baseOrder = orderRank * 2;

    datasets.push({
      label: `Station ${STATION_IDS[index] || index} (White)`,
      data: data,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      backgroundColor: 'transparent',
      borderWidth: 0.8,
      pointRadius: 0,
      tension: 0,
      fill: false,
      spanGaps: false,
      order: baseOrder,
    });

    datasets.push({
      label: `Station ${STATION_IDS[index] || index}`,
      data: data,
      borderColor: config.color,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
      spanGaps: false,
      order: baseOrder,
    });
  });

  return datasets;
}

// 處理完整的圖表數據
function processChartData(waveformData, stationConfigs) {
  const channelDataArrays = processWaveformData(waveformData, stationConfigs);
  const indexToOrder = calculateChannelMaxValues(channelDataArrays);
  const datasets = generateChartDatasets(channelDataArrays, indexToOrder);
  const timeLabels = generateTimeLabels(CHART_LENGTH, 50);

  return {
    labels: timeLabels,
    datasets: datasets,
  };
}

self.onmessage = function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'PROCESS_CHART_DATA':
        const chartData = processChartData(data.waveformData, data.stationConfigs);
        self.postMessage({
          type: 'CHART_DATA_SUCCESS',
          data: chartData,
        });
        break;
      
      case 'GENERATE_TIME_LABELS':
        const timeLabels = generateTimeLabels(data.length, data.sampleRate);
        self.postMessage({
          type: 'TIME_LABELS_SUCCESS',
          data: timeLabels,
        });
        break;
      
      case 'GENERATE_CHANNEL_CONFIGS':
        const channelConfigs = generateChannelConfigs();
        self.postMessage({
          type: 'CHANNEL_CONFIGS_SUCCESS',
          data: channelConfigs,
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
