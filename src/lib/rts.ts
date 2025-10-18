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

export let REPLAY_TIME = 0;

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
    alert?: boolean;
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

export async function fetchStationInfo(): Promise<Map<string, StationInfo>> {
  const response = await fetch('https://api-1.exptech.dev/api/v1/trem/station');
  const data = await response.json();
  const stationMap = new Map<string, StationInfo>();

  for (const [uuid, station] of Object.entries(data)) {
    stationMap.set(uuid, station as StationInfo);
  }

  return stationMap;
}

export async function fetchRTSData(): Promise<RTSResponse> {
  let url: string;
  if (REPLAY_TIME === 0) {
    url = 'https://lb.exptech.dev/api/v1/trem/rts';
  } else {
    url = `https://api-1.exptech.dev/api/v2/trem/rts/${REPLAY_TIME}`;
    REPLAY_TIME += 1;
  }

  const response = await fetch(url);
  const data = await response.json();

  return {
    time: data.time || Date.now(),
    station: data.station || {},
    int: data.int || [],
    box: data.box || {},
  };
}

export function createStationGeoJSON(
  stationMap: Map<string, StationInfo>,
  rtsData: Record<string, RTSData>
): StationGeoJSON {
  const features: StationFeature[] = [];

  for (const [stationId, rts] of Object.entries(rtsData)) {
    const station = stationMap.get(stationId);
    if (!station || !station.work || station.info.length === 0) continue;

    const latestInfo = station.info[station.info.length - 1];
    const intensity = rts.alert ? rts.I : rts.i;
    const color = getIntensityColor(intensity);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [latestInfo.lon, latestInfo.lat],
      },
      properties: {
        id: stationId,
        code: latestInfo.code.toString(),
        intensity,
        color,
        sortKey: intensity,
        alert: !!rts.alert,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export async function fetchAndProcessStationData(): Promise<ProcessedStationData> {
  const [stationMap, rtsResponse] = await Promise.all([
    fetchStationInfo(),
    fetchRTSData(),
  ]);

  const geojson = createStationGeoJSON(stationMap, rtsResponse.station);

  return {
    geojson,
    time: rtsResponse.time,
    int: rtsResponse.int,
    box: rtsResponse.box,
  };
}
