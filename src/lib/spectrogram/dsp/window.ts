export type WindowFunctionType = 'hann' | 'hamming' | 'blackman' | 'rectangular';

export const createWindow = (size: number, type: WindowFunctionType): Float32Array => {
    const window = new Float32Array(size);

    if (type === 'rectangular') {
        return window.fill(1);
    }

    const TWO_PI = 2 * Math.PI;
    const denom = size - 1;

    switch (type) {
        case 'hann':
            for (let i = 0; i < size; i++) {
                window[i] = 0.5 * (1 - Math.cos((TWO_PI * i) / denom));
            }
            break;
        case 'hamming':
            for (let i = 0; i < size; i++) {
                window[i] = 0.54 - 0.46 * Math.cos((TWO_PI * i) / denom);
            }
            break;
        case 'blackman':
            for (let i = 0; i < size; i++) {
                const angle = (TWO_PI * i) / denom;
                window[i] = 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
            }
            break;
    }

    return window;
};
