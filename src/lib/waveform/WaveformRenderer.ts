import type { WaveformRenderData } from './types';

const CHART_LENGTH = 3000;
const TOTAL_HEIGHT = 630;

export class WaveformRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastDPR = 0;

  private calibrateCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;

    if (this.ctx && this.lastWidth === cssW && this.lastHeight === cssH && this.lastDPR === dpr) {
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
    this.ctx = ctx;
    return ctx;
  }

  render(canvas: HTMLCanvasElement, data: WaveformRenderData, theme: 'dark' | 'light'): void {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const ctx = this.calibrateCanvas(canvas, cssW, cssH);
    const isDark = theme === 'dark';
    const xScale = cssW / CHART_LENGTH;
    const yScale = cssH / TOTAL_HEIGHT;

    // Clear background
    ctx.fillStyle = isDark ? '#111827' : '#f9fafb';
    ctx.fillRect(0, 0, cssW, cssH);

    if (!data.channels?.length) return;

    // Draw baselines
    ctx.strokeStyle = isDark ? 'rgba(107, 114, 128, 0.4)' : 'rgba(156, 163, 175, 0.4)';
    ctx.lineWidth = 0.8;
    for (const ch of data.channels) {
      const y = (TOTAL_HEIGHT - ch.baseline) * yScale;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    // Draw time grid
    ctx.strokeStyle = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.4)';
    ctx.lineWidth = 0.5;
    for (const label of data.timeLabels) {
      const x = label.x * xScale;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH - 20);
      ctx.stroke();
    }

    // Draw waveforms (larger amplitude first)
    const sorted = [...data.channels].sort((a, b) => b.order - a.order);
    for (const ch of sorted) {
      this.drawLine(ctx, ch.points, xScale, yScale, 'rgba(255,255,255,0.3)', 0.8);
      this.drawLine(ctx, ch.points, xScale, yScale, ch.color, 1.5);
    }

    // Draw time labels
    ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    for (const label of data.timeLabels) {
      ctx.fillText(label.text, label.x * xScale, cssH - 4);
    }
  }

  private drawLine(ctx: CanvasRenderingContext2D, points: Float32Array, xScale: number, yScale: number, color: string, width: number): void {
    if (!points?.length) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let drawing = false;
    for (let i = 0; i < points.length; i++) {
      const y = points[i];
      if (Number.isNaN(y)) {
        if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; }
        continue;
      }
      const cx = i * xScale;
      const cy = (TOTAL_HEIGHT - y) * yScale;
      if (!drawing) { ctx.moveTo(cx, cy); drawing = true; }
      else { ctx.lineTo(cx, cy); }
    }
    if (drawing) ctx.stroke();
  }

  dispose(): void {
    this.ctx = null;
  }
}
