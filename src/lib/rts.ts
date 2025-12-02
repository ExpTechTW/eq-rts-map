export interface StationInfo {
  net: string;
  info: Array<{
    code: number;
    lat: number;
    lon: number;
    time: string;
  }>;
  work: boolean;
}

export interface RTSData {
  pga: number;
  pgv: number;
  i: number;
  I: number;
  alert?: number;
}

export interface RTSResponse {
  time: number;
  station: Record<string, RTSData>;
  int: any[];
  box: Record<string, any>;
}


export interface StationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    code: string;
    intensity: number;
    color: string;
    sortKey: number;
    hasAlert?: boolean;
    pga?: number;
    isConnected?: boolean;
  };
}

export interface StationGeoJSON {
  type: 'FeatureCollection';
  features: StationFeature[];
}

export interface ProcessedStationData {
  geojson: StationGeoJSON;
  time: number;
  int: any[];
  box: Record<string, any>;
}

export const INTENSITY_COLOR_STOPS = [
  { value: -3, color: '#0005d0' },
  { value: -2, color: '#004bf8' },
  { value: -1, color: '#009EF8' },
  { value: 0, color: '#79E5FD' },
  { value: 1, color: '#49E9AD' },
  { value: 2, color: '#44fa34' },
  { value: 3, color: '#beff0c' },
  { value: 4, color: '#fff000' },
  { value: 5, color: '#ff9300' },
  { value: 6, color: '#fc5235' },
  { value: 7, color: '#b720e9' },
];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getIntensityColor(intensity: number): string {
  if (intensity <= INTENSITY_COLOR_STOPS[0].value) {
    return INTENSITY_COLOR_STOPS[0].color;
  }
  if (intensity >= INTENSITY_COLOR_STOPS[INTENSITY_COLOR_STOPS.length - 1].value) {
    return INTENSITY_COLOR_STOPS[INTENSITY_COLOR_STOPS.length - 1].color;
  }

  for (let i = 0; i < INTENSITY_COLOR_STOPS.length - 1; i++) {
    const stop1 = INTENSITY_COLOR_STOPS[i];
    const stop2 = INTENSITY_COLOR_STOPS[i + 1];

    if (intensity >= stop1.value && intensity <= stop2.value) {
      const t = (intensity - stop1.value) / (stop2.value - stop1.value);
      const rgb1 = hexToRgb(stop1.color);
      const rgb2 = hexToRgb(stop2.color);

      const r = lerp(rgb1[0], rgb2[0], t);
      const g = lerp(rgb1[1], rgb2[1], t);
      const b = lerp(rgb1[2], rgb2[2], t);

      return rgbToHex(r, g, b);
    }
  }

  return INTENSITY_COLOR_STOPS[0].color;
}



// 可重用的 GeoJSON 物件池
const featurePool: StationFeature[] = [];
const reusableGeoJSON: StationGeoJSON = {
  type: 'FeatureCollection',
  features: []
};

// 從池中取得或創建 feature
function getFeature(index: number): StationFeature {
  if (index < featurePool.length) {
    return featurePool[index];
  }
  const feature: StationFeature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {
      id: '',
      code: '',
      intensity: 0,
      color: '',
      sortKey: 0,
      hasAlert: false,
      pga: 0
    }
  };
  featurePool.push(feature);
  return feature;
}

export function createStationGeoJSON(
  stationMap: Map<string, StationInfo>,
  rtsData: Record<string, RTSData>
): StationGeoJSON {
  let featureIndex = 0;

  for (const [stationId, rts] of Object.entries(rtsData)) {
    const station = stationMap.get(stationId);
    if (!station || !station.work || station.info.length === 0) continue;

    const latestInfo = station.info[station.info.length - 1];
    const intensity = rts.alert ? rts.I : rts.i;
    const color = getIntensityColor(intensity);

    // 重用 feature 物件
    const feature = getFeature(featureIndex);
    feature.geometry.coordinates[0] = latestInfo.lon;
    feature.geometry.coordinates[1] = latestInfo.lat;
    feature.properties.id = stationId;
    feature.properties.code = latestInfo.code.toString();
    feature.properties.intensity = intensity;
    feature.properties.color = color;
    feature.properties.sortKey = intensity;
    feature.properties.hasAlert = rts.alert != undefined;
    feature.properties.pga = rts.pga || 0;

    featureIndex++;
  }

  // 設定實際使用的 features 長度
  reusableGeoJSON.features = featurePool.slice(0, featureIndex);

  return reusableGeoJSON;
}

