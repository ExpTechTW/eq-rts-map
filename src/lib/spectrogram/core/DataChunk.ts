import { FFTExecutor } from '../dsp/fft';
import { createWindow } from '../dsp/window';
import { SpectrogramConfig, SpectrogramData } from './SpectrogramModel';

export class ChunkProcessor {
    private fft: FFTExecutor;
    private windowBuffer: Float32Array;
    private inputBuf: Float32Array;

    constructor(config: SpectrogramConfig) {
        const fftSize = config.fftSize ?? 1024;
        this.fft = new FFTExecutor(fftSize);
        this.windowBuffer = createWindow(config.windowSize, config.windowType);
        this.inputBuf = new Float32Array(fftSize);
    }

    process(
        data: SpectrogramData,
        startIdx: number,
        endIdx: number,
        config: SpectrogramConfig,
        colormapToRgb: (normalizedVal: number) => [number, number, number]
    ): ImageData {
        const { windowSize, minDb, maxDb, overlap } = config;
        const hopSize = Math.max(1, windowSize - overlap);
        const fftSize = this.fft.size();

        const numHops = Math.ceil((endIdx - startIdx) / hopSize);
        const width = numHops;
        const height = (fftSize >> 1) + 1;

        if (width <= 0) {
            return new ImageData(1, 1);
        }

        const imgData = new ImageData(width, height);
        const pixels = imgData.data;
        const inputBuf = this.inputBuf;
        const windowBuf = this.windowBuffer;

        let dcSum = 0;
        let validCount = 0;
        for (let i = 0; i < windowSize; i++) {
            const idx = startIdx + i;
            if (idx < data.length) {
                dcSum += data[idx];
                validCount++;
            }
        }

        for (let x = 0; x < width; x++) {
            const signalStart = startIdx + x * hopSize;
            const mean = validCount > 0 ? dcSum / validCount : 0;

            const end = Math.min(windowSize, data.length - signalStart);
            let i = 0;
            for (; i < end; i++) {
                inputBuf[i] = (data[signalStart + i] - mean) * windowBuf[i];
            }
            for (; i < fftSize; i++) {
                inputBuf[i] = 0;
            }

            const mags = this.fft.compute(inputBuf, minDb, maxDb);

            for (let y = 0; y < height; y++) {
                const val = mags[y];
                const rgb = colormapToRgb(val);
                const row = height - 1 - y;
                const idx = (row * width + x) * 4;
                pixels[idx] = rgb[0];
                pixels[idx + 1] = rgb[1];
                pixels[idx + 2] = rgb[2];
                pixels[idx + 3] = 255;
            }

            if (x + 1 < width) {
                for (let k = 0; k < hopSize; k++) {
                    const outIdx = signalStart + k;
                    if (outIdx < data.length) {
                        dcSum -= data[outIdx];
                        validCount--;
                    }
                }

                const nextStart = signalStart + windowSize;
                for (let k = 0; k < hopSize; k++) {
                    const inIdx = nextStart + k;
                    if (inIdx < data.length) {
                        dcSum += data[inIdx];
                        validCount++;
                    }
                }
            }
        }

        return imgData;
    }

    dispose(): void {
        this.fft.dispose();
    }
}
