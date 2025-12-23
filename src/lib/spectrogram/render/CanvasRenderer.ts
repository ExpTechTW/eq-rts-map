import { ChunkProcessor } from '../core/DataChunk';
import { SpectrogramModel } from '../core/SpectrogramModel';
import { ColorMap, ColorMapName } from './ColorMap';

export interface RenderOptions {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    timeRange: [number, number];
    freqRange: [number, number];
}

export class CanvasRenderer {
    private model: SpectrogramModel;
    private processor: ChunkProcessor;
    private colormap: ColorMap;

    private ctx: CanvasRenderingContext2D | null = null;
    private lastW = 0;
    private lastH = 0;
    private lastDPR = 0;

    constructor(model: SpectrogramModel) {
        this.model = model;
        this.processor = new ChunkProcessor(model.config);
        this.colormap = new ColorMap('jet');
    }

    setColormap(name: ColorMapName) {
        this.colormap.setMap(name);
    }

    clearCache() {
        // No cache needed for direct rendering
    }

    private setupCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
        const dpr = window.devicePixelRatio || 1;

        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);

        const ctx = canvas.getContext('2d', { alpha: false })!;
        ctx.imageSmoothingEnabled = false;

        return ctx;
    }

    private calibrateCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
        const dpr = window.devicePixelRatio || 1;

        if (this.ctx && this.lastW === cssW && this.lastH === cssH && this.lastDPR === dpr) {
            return this.ctx;
        }

        this.lastW = cssW;
        this.lastH = cssH;
        this.lastDPR = dpr;

        this.ctx = this.setupCanvas(canvas, cssW, cssH);
        return this.ctx;
    }

    render(options: RenderOptions) {
        const { canvas, timeRange, freqRange } = options;
        const ctx = this.calibrateCanvas(canvas, options.width, options.height);

        const dpr = window.devicePixelRatio || 1;
        const width = options.width;
        const height = options.height;
        const [tStart, tEnd] = timeRange;
        const [fMin, fMax] = freqRange;

        // Clear with dark background
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!this.model.data || this.model.data.length === 0) {
            return;
        }

        const sampleRate = this.model.config.sampleRate;
        const config = this.model.config;
        const nyquist = sampleRate / 2;

        const viewStartIdx = Math.floor(Math.max(0, tStart * sampleRate));
        const viewEndIdx = Math.floor(Math.min(this.model.data.length, tEnd * sampleRate));

        if (viewEndIdx <= viewStartIdx) {
            return;
        }

        // Process the entire visible range and get ImageData
        const imgData = this.processor.process(
            this.model.data,
            viewStartIdx,
            viewEndIdx,
            config,
            (val) => this.colormap.getRGB(val)
        );

        if (imgData.width <= 0 || imgData.height <= 0) {
            return;
        }

        // Create a temporary canvas to hold the spectrogram image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgData.width;
        tempCanvas.height = imgData.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(imgData, 0, 0);

        // Calculate frequency range mapping
        const safeFMax = Math.min(fMax, nyquist);
        const safeFMin = Math.max(fMin, 0);

        const texH = imgData.height;
        const sy_top = (1 - safeFMax / nyquist) * texH;
        const sy_bottom = (1 - safeFMin / nyquist) * texH;
        const sy_h = sy_bottom - sy_top;

        if (sy_h > 0) {
            // Draw the spectrogram scaled to fill the canvas
            ctx.drawImage(
                tempCanvas,
                0, sy_top, imgData.width, sy_h,  // source
                0, 0, canvas.width, canvas.height  // destination
            );
        }
    }

    dispose(): void {
        this.processor.dispose();
    }
}
