export interface Pipeline {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    execute(data: any): Promise<any>;
}
export interface PipelineEngine {
    createPipeline(config: any): Pipeline;
    runPipeline(pipelineId: string, data: any): Promise<any>;
    stopPipeline(pipelineId: string): Promise<void>;
}
export declare class DataPipelineEngine implements PipelineEngine {
    private pipelines;
    createPipeline(config: any): Pipeline;
    runPipeline(pipelineId: string, data: any): Promise<any>;
    stopPipeline(pipelineId: string): Promise<void>;
    private processPipelineStages;
    private processStage;
}
//# sourceMappingURL=pipeline-engine.d.ts.map