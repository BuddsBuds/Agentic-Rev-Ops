import { EventEmitter } from 'events';
export interface RealtimeProcessor {
    start(): Promise<void>;
    stop(): Promise<void>;
    process(data: any): Promise<any>;
    onData(handler: (data: any) => void): void;
}
export declare class RealtimeDataProcessor extends EventEmitter implements RealtimeProcessor {
    private isRunning;
    private processingQueue;
    private processingInterval?;
    start(): Promise<void>;
    stop(): Promise<void>;
    process(data: any): Promise<any>;
    onData(handler: (data: any) => void): void;
    private startProcessing;
    private processBatch;
    private processData;
    processStream(stream: any): Promise<void>;
    processBatchData(data: any[], options?: any): Promise<any[]>;
}
//# sourceMappingURL=realtime-processor.d.ts.map