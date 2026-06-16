declare module '@tensorflow-models/mobilenet' {
    export interface MobileNet {
        classify(img: any, topk?: number): Promise<Array<{className: string; probability: number}>>;
    }
    export function load(config?: { version?: number; alpha?: number }): Promise<MobileNet>;
}