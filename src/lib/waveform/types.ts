export interface WaveformChannel {
  stationId: number;
  baseline: number;
  color: string;
  points: Float32Array;
  order: number;
}

export interface TimeLabel {
  x: number;
  text: string;
}

export interface WaveformRenderData {
  channels: WaveformChannel[];
  timeLabels: TimeLabel[];
}

export interface ChannelConfig {
  baseline: number;
  color: string;
}
