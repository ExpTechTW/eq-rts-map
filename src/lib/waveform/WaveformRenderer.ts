import type { WaveformRenderData, WaveformChannel, TimeLabel } from './types';

const CHART_LENGTH = 3000;
const TOTAL_HEIGHT = 630;

export class WaveformRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastDPR = 0;

  private calibrateCanvas(
    canvas: HTMLCanvasElement,
    cssW: number,
    cssH: number
  ): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;

    if (
      this.ctx &&
      this.lastWidth === cssW &&
      this.lastHeight === cssH &&
      this.lastDPR === dpr
    ) {
      return this.ctx;
    }

    this.lastWidth = cssW;
    this.lastHeight = cssH;
    this.lastDPR = dpr;

    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    this.ctx = ctx;
    return ctx;
  }

  render(
    canvas: HTMLCanvasElement,
    data: WaveformRenderData,
    theme: 'dark' | 'light'
  ): void {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;

    if (cssW === 0 || cssH === 0) return;

    const ctx = this.calibrateCanvas(canvas, cssW, cssH);

    // 1. Clear background
    ctx.fillStyle = theme === 'dark' ? '#111827' : '#f9fafb';
    ctx.fillRect(0, 0, cssW, cssH);

    if (!data.channels || data.channels.length === 0) return;

    // 2. Draw baselines
    this.drawBaselines(ctx, data.channels, cssW, cssH, theme);

    // 3. Draw time grid
    this.drawTimeGrid(ctx, data.timeLabels, cssW, cssH, theme);

    // 4. Sort channels by order (larger amplitude first, draw at bottom)
    const sortedChannels = [...data.channels].sort((a, b) => b.order - a.order);

    // 5. Draw waveforms
    for (const channel of sortedChannels) {
      // White outline
      this.drawWaveform(
        ctx,
        channel.points,
        channel.baseline,
        'rgba(255, 255, 255, 0.3)',
        0.8,
        cssW,
        cssH
      );
      // Colored main line
      this.drawWaveform(
        ctx,
        channel.points,
        channel.baseline,
        channel.color,
        1.5,
        cssW,
        cssH
      );
    }

    // 6. Draw time labels
    this.drawTimeLabels(ctx, data.timeLabels, cssW, cssH, theme);
  }

  private drawWaveform(
    ctx: CanvasRenderingContext2D,
    points: Float32Array,
    baseline: number,
    color: string,
    lineWidth: number,
    cssW: number,
    cssH: number
  ): void {
    if (!points || points.length === 0) return;

    const xScale = cssW / CHART_LENGTH;
    const yScale = cssH / TOTAL_HEIGHT;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let isDrawing = false;

    for (let i = 0; i < points.length; i++) {
      const y = points[i];
      const x = i * xScale;

      if (Number.isNaN(y)) {
        if (isDrawing) {
          ctx.stroke();
          ctx.beginPath();
          isDrawing = false;
        }
        continue;
      }

      // Convert from data coordinate to canvas coordinate
      // In data: y increases upward, baseline is reference
      // In canvas: y increases downward
      const canvasY = (TOTAL_HEIGHT - y) * yScale;

      if (!isDrawing) {
        ctx.moveTo(x, canvasY);
        isDrawing = true;
      } else {
        ctx.lineTo(x, canvasY);
      }
    }

    if (isDrawing) {
      ctx.stroke();
    }
  }

  private drawBaselines(
    ctx: CanvasRenderingContext2D,
    channels: WaveformChannel[],
    cssW: number,
    cssH: number,
    theme: 'dark' | 'light'
  ): void {
    const baselineColor =
      theme === 'dark'
        ? 'rgba(107, 114, 128, 0.4)'
        : 'rgba(156, 163, 175, 0.4)';
    const yScale = cssH / TOTAL_HEIGHT;

    ctx.strokeStyle = baselineColor;
    ctx.lineWidth = 0.8;

    for (const channel of channels) {
      const canvasY = (TOTAL_HEIGHT - channel.baseline) * yScale;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(cssW, canvasY);
      ctx.stroke();
    }
  }

  private drawTimeGrid(
    ctx: CanvasRenderingContext2D,
    timeLabels: TimeLabel[],
    cssW: number,
    cssH: number,
    theme: 'dark' | 'light'
  ): void {
    const gridColor =
      theme === 'dark'
        ? 'rgba(75, 85, 99, 0.3)'
        : 'rgba(209, 213, 219, 0.4)';
    const xScale = cssW / CHART_LENGTH;
    const labelAreaHeight = 20;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    for (const label of timeLabels) {
      const x = label.x * xScale;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH - labelAreaHeight);
      ctx.stroke();
    }
  }

  private drawTimeLabels(
    ctx: CanvasRenderingContext2D,
    timeLabels: TimeLabel[],
    cssW: number,
    cssH: number,
    theme: 'dark' | 'light'
  ): void {
    const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
    const xScale = cssW / CHART_LENGTH;

    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const label of timeLabels) {
      const x = label.x * xScale;
      ctx.fillText(label.text, x, cssH - 4);
    }
  }

  dispose(): void {
    this.ctx = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.lastDPR = 0;
  }
}
