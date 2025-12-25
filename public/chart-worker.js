const STATION_IDS = [4812424, 6126556, 11336952, 11334880, 1480496];
const CHART_LENGTH = 3000;
const TOTAL_HEIGHT = 630;
const BASE_GAP = TOTAL_HEIGHT / 6;
const TOP_GAP = BASE_GAP - 50;
const MIDDLE_GAP = BASE_GAP + 25;

// Filter coefficients
const NUM_LPF = [
  [0.8063260828207, 0, 0], [1, -0.3349099821478, 1],
  [0.8764452158503, 0, 0], [1, -0.08269016387548, 1],
  [0.8131516681065, 0, 0], [1, 0.5521204464881, 1],
  [1.228277124762, 0, 0], [1, 1.705652561121, 1],
  [0.00431639855615, 0, 0], [1, -0.4218227257396, 1], [1, 0, 0],
];
const DEN_LPF = [
  [1, 0, 0], [1, -0.6719798550872, 0.938845023254],
  [1, 0, 0], [1, -0.8264759910073, 0.8561761588872],
  [1, 0, 0], [1, -1.10962299915, 0.7141202529829],
  [1, 0, 0], [1, -1.413006561919, 0.5638384962434],
  [1, 0, 0], [1, -0.6139497794955, 0.9834048810788], [1, 0, 0],
];
const NUM_HPF = [
  [0.9769037485204, 0, 0], [1, -2, 1],
  [0.9424328308459, 0, 0], [1, -2, 1],
  [0.9149691441131, 0, 0], [1, -2, 1],
  [0.8959987277275, 0, 0], [1, -2, 1],
  [0.8863374802187, 0, 0], [1, -2, 1], [1, 0, 0],
];
const DEN_HPF = [
  [1, 0, 0], [1, -1.946073828052, 0.9615411660298],
  [1, 0, 0], [1, -1.877404882092, 0.8923264412918],
  [1, 0, 0], [1, -1.822694925196, 0.837181651256],
  [1, 0, 0], [1, -1.78490427193, 0.7990906389804],
  [1, 0, 0], [1, -1.765658260281, 0.7796916605933], [1, 0, 0],
];

// Filter cache
const filterCache = new Map();

function createFilter(num, den) {
  const stages = num.map((n, i) => {
    const [b0, b1, b2] = n;
    const [a0, a1, a2] = den[i];
    const k = a0 !== 1 ? 1 / a0 : 1;
    return { b0: b0 * k, b1: b1 * k, b2: b2 * k, a1: a1 * k, a2: a2 * k, z1: 0, z2: 0 };
  });
  return (x) => {
    for (const s of stages) {
      const out = s.b0 * x + s.z1;
      s.z1 = s.b1 * x - s.a1 * out + s.z2;
      s.z2 = s.b2 * x - s.a2 * out;
      x = out;
    }
    return x;
  };
}

function getFilters(stationId) {
  if (!filterCache.has(stationId)) {
    filterCache.set(stationId, {
      hpf: createFilter(NUM_HPF, DEN_HPF),
      lpf: createFilter(NUM_LPF, DEN_LPF)
    });
  }
  return filterCache.get(stationId);
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 1/6) { r = c; g = x; b = 0; }
  else if (h < 2/6) { r = x; g = c; b = 0; }
  else if (h < 3/6) { r = 0; g = c; b = x; }
  else if (h < 4/6) { r = 0; g = x; b = c; }
  else if (h < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return `rgb(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)})`;
}

function idToColor(id) {
  let hash = 0;
  for (const c of String(id)) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  hash = Math.abs(hash);
  return hslToRgb((hash % 360) / 360, (85 + hash % 15) / 100, (50 + hash % 10) / 100);
}

const CHANNEL_CONFIGS = STATION_IDS.map((id, i) => ({
  baseline: TOTAL_HEIGHT - TOP_GAP - MIDDLE_GAP * i,
  color: idToColor(id)
}));

const TIME_LABELS = (() => {
  const labels = [];
  for (let i = 0; i < CHART_LENGTH; i++) {
    const pos = CHART_LENGTH - i;
    if (pos % 500 === 250 && pos > 0) {
      labels.push({ x: i, text: String(pos / 50) });
    }
  }
  return labels;
})();

function processChartDataForCanvas(waveformData, stationConfigs) {
  const channels = STATION_IDS.map((stationId, index) => {
    const config = CHANNEL_CONFIGS[index];
    const stationConfig = stationConfigs[stationId];

    if (!stationConfig) {
      return { stationId, baseline: config.baseline, color: config.color, points: new Float32Array(CHART_LENGTH).fill(NaN), order: 0 };
    }

    const raw = waveformData[stationId] || [];
    const { hpf, lpf } = getFilters(stationId);
    const { scale, sampleRate } = stationConfig;
    const is20Hz = sampleRate === 20;
    const points = new Float32Array(CHART_LENGTH);
    points.fill(NaN);

    let writeIdx = CHART_LENGTH;
    for (let i = raw.length - 1; i >= 0 && writeIdx > 0; i--) {
      const v = raw[i];
      const scaled = v != null ? lpf(hpf(v)) * scale + config.baseline : NaN;
      const repeat = is20Hz ? (i % 2 === 0 ? 3 : 2) : 1;
      for (let r = 0; r < repeat && writeIdx > 0; r++) {
        points[--writeIdx] = scaled;
      }
    }

    return { stationId, baseline: config.baseline, color: config.color, points, order: 0 };
  });

  // Calculate order by max deviation
  const deviations = channels.map((ch, idx) => {
    let max = 0;
    for (let i = 0; i < ch.points.length; i++) {
      const v = ch.points[i];
      if (!Number.isNaN(v)) max = Math.max(max, Math.abs(v - ch.baseline));
    }
    return { idx, max };
  });
  deviations.sort((a, b) => a.max - b.max);
  deviations.forEach((d, order) => { channels[d.idx].order = order; });

  return { channels, timeLabels: TIME_LABELS };
}

self.onmessage = function(e) {
  const { type, data } = e.data;
  try {
    switch (type) {
      case 'PROCESS_CHART_DATA_CANVAS':
        const result = processChartDataForCanvas(data.waveformData, data.stationConfigs);
        self.postMessage(
          { type: 'CHART_DATA_CANVAS_SUCCESS', data: result },
          result.channels.map(ch => ch.points.buffer)
        );
        break;
      case 'GENERATE_CHANNEL_CONFIGS':
        self.postMessage({ type: 'CHANNEL_CONFIGS_SUCCESS', data: CHANNEL_CONFIGS });
        break;
      default:
        self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
