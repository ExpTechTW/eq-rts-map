import WebFFT from 'webfft';

export class FFTExecutor {
    private readonly EPS = 1e-20;
    private readonly INV_LN10 = 1 / Math.LN10;

    private readonly fftSize: number;
    private readonly fft: WebFFT;

    private readonly complexIn: Float32Array;
    private readonly spectrum: Float32Array;

    constructor(fftSize: number) {
        if ((fftSize & (fftSize - 1)) !== 0) {
            throw new Error('FFT size must be power of two');
        }

        this.fftSize = fftSize;
        this.fft = new WebFFT(fftSize);
        const benchmark = this.fft.profile(0.5);
        const backend = benchmark.fastestSubLibrary;
        this.fft.setSubLibrary(backend);

        this.complexIn = new Float32Array(fftSize * 2);
        this.spectrum = new Float32Array(fftSize / 2 + 1);
    }

    size(): number {
        return this.fftSize;
    }

    compute(input: Float32Array, minDb: number, maxDb: number): Float32Array {
        const N = this.fftSize;
        const cin = this.complexIn;

        for (let i = 0; i < N; i++) {
            const j = i << 1;
            cin[j] = input[i];
            cin[j + 1] = 0;
        }

        const out = this.fft.fft(cin);
        const spec = this.spectrum;

        const n = spec.length;
        const invRange = 1 / (maxDb - minDb);
        const eps = this.EPS;
        const invLn10 = this.INV_LN10;

        for (let i = 0; i < n; i++) {
            const j = i << 1;
            const re = out[j];
            const im = out[j + 1];
            const p = re * re + im * im + eps;

            const v = (10 * Math.log(p) * invLn10 - minDb) * invRange;
            spec[i] = v < 0 ? 0 : v > 1 ? 1 : v;
        }

        return spec;
    }

    dispose(): void {
        this.fft.dispose();
    }
}
