import { WindowFunctionType } from '../dsp/window';

export interface SpectrogramConfig {
    sampleRate: number;
    windowSize: number;
    overlap: number;
    fftSize?: number;
    windowType: WindowFunctionType;
    minDb: number;
    maxDb: number;
}

export type SpectrogramData = Float32Array | Float64Array;

export class SpectrogramModel {
    config: SpectrogramConfig;
    data: SpectrogramData | null = null;
    startTime: number = 0;
    computedFftSize: number;

    constructor(config: SpectrogramConfig) {
        this.config = config;
        this.computedFftSize = config.fftSize ?? this.nextPowerOfTwo(config.windowSize);
    }

    setData(data: SpectrogramData) {
        this.data = data;
        this.startTime = 0;
    }

    updateConfig(newConfig: Partial<SpectrogramConfig>) {
        const merged = { ...this.config, ...newConfig };
        this.config = merged;
        if (newConfig.windowSize || newConfig.fftSize) {
            this.computedFftSize =
                this.config.fftSize || this.nextPowerOfTwo(this.config.windowSize);
        }
    }

    private nextPowerOfTwo(n: number): number {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }

    getDuration(): number {
        return this.data ? this.data.length / this.config.sampleRate : 0;
    }
}
