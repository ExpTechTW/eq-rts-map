export type ColorMapName =
    | 'viridis'
    | 'inferno'
    | 'grayscale'
    | 'jet'
    | 'hot'
    | 'cool'
    | 'spring'
    | 'summer'
    | 'autumn'
    | 'winter'
    | 'bone';

type RGB = [number, number, number];

function interpolateColorMap(t: number, map: number[][]): RGB {
    if (t <= 0) return map[0] as RGB;
    if (t >= 1) return map[map.length - 1] as RGB;

    const step = 1 / (map.length - 1);
    const idx = (t / step) | 0;
    const localT = (t - idx * step) / step;

    const c1 = map[idx];
    const c2 = map[idx + 1];

    return [
        (c1[0] + (c2[0] - c1[0]) * localT) | 0,
        (c1[1] + (c2[1] - c1[1]) * localT) | 0,
        (c1[2] + (c2[2] - c1[2]) * localT) | 0
    ];
}

const VIRIDIS_MAP = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
const INFERNO_MAP = [[0, 0, 4], [87, 16, 110], [187, 55, 84], [249, 142, 9], [252, 255, 164]];

function viridis(t: number): RGB {
    return interpolateColorMap(t, VIRIDIS_MAP);
}

function inferno(t: number): RGB {
    return interpolateColorMap(t, INFERNO_MAP);
}

function grayscale(t: number): RGB {
    const v = Math.floor(t * 255);
    return [v, v, v];
}

function jet(t: number): RGB {
    const v = Math.max(0, Math.min(1, t));
    const r = Math.min(4 * v - 1.5, -4 * v + 4.5);
    const g = Math.min(4 * v - 0.5, -4 * v + 3.5);
    const b = Math.min(4 * v + 0.5, -4 * v + 2.5);

    return [
        Math.floor(Math.max(0, Math.min(1, r)) * 255),
        Math.floor(Math.max(0, Math.min(1, g)) * 255),
        Math.floor(Math.max(0, Math.min(1, b)) * 255)
    ];
}

function hot(t: number): RGB {
    let r = 0,
        g = 0,
        b = 0;

    if (t < 0.33) {
        r = t / 0.33;
    } else if (t < 0.66) {
        r = 1;
        g = (t - 0.33) / 0.33;
    } else {
        r = 1;
        g = 1;
        b = (t - 0.66) / 0.34;
    }

    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function cool(t: number): RGB {
    const r = t;
    const g = 1 - t;
    const b = 1;
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function spring(t: number): RGB {
    return [255, Math.floor(t * 255), Math.floor((1 - t) * 255)];
}

function summer(t: number): RGB {
    return [Math.floor(t * 255), Math.floor((0.5 + 0.5 * t) * 255), Math.floor(0.4 * 255)];
}

function autumn(t: number): RGB {
    return [255, Math.floor(t * 255), 0];
}

function winter(t: number): RGB {
    return [0, Math.floor(t * 255), Math.floor((1.0 - 0.5 * t) * 255)];
}

function bone(t: number): RGB {
    const r = t;
    const sin = 0.1 * Math.sin(t * Math.PI * 2);
    const g = t < 0.5 ? t + sin : t;
    const b = t < 0.75 ? t + sin : t;

    return [
        Math.floor(Math.min(1, r) * 255),
        Math.floor(Math.min(1, g) * 255),
        Math.floor(Math.min(1, b) * 255)
    ];
}

const COLOR_MAP_FNS: Record<ColorMapName, (t: number) => RGB> = {
    viridis,
    inferno,
    grayscale,
    jet,
    hot,
    cool,
    spring,
    summer,
    autumn,
    winter,
    bone
};

export class ColorMap {
    private type: ColorMapName;
    private lut: Uint8Array;

    constructor(type: ColorMapName = 'viridis') {
        this.type = type;
        this.lut = new Uint8Array(256 * 3);
        this.generateLut();
    }

    private generateLut() {
        const fn = COLOR_MAP_FNS[this.type];
        for (let i = 0; i < 256; i++) {
            const rgb = fn(i / 255);
            const j = i * 3;
            this.lut[j] = rgb[0];
            this.lut[j + 1] = rgb[1];
            this.lut[j + 2] = rgb[2];
        }
    }

    getRGB(t: number): RGB {
        const idx = (t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0) * 3;
        return [this.lut[idx], this.lut[idx + 1], this.lut[idx + 2]];
    }

    setMap(type: ColorMapName) {
        this.type = type;
        this.generateLut();
    }
}
