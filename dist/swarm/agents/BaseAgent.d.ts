import { EventEmitter } from 'events';
import { AgentInterface, AgentReport, AgentCapability, TaskResult } from '../types';
export interface BaseAgentConfig {
    id: string;
    type: string;
    name: string;
    capabilities: string[];
    votingWeight?: number;
    learningEnabled?: boolean;
}
export interface AgentState {
    status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
    currentTask?: string;
    taskQueue: string[];
    performance: PerformanceMetrics;
    lastActivity: Date;
}
export interface PerformanceMetrics {
    tasksCompleted: number;
    tasksTotal: number;
    successRate: number;
    avgResponseTime: number;
    avgConfidence: number;
    specialtyScores: Map<string, number>;
}
export declare abstract class BaseAgent extends EventEmitter implements AgentInterface {
    protected config: BaseAgentConfig;
    protected state: AgentState;
    protected capabilities: Map<string, AgentCapability>;
    protected learningHistory: TaskResult[];
    protected queenConnection?: any;
    constructor(config: BaseAgentConfig);
    initialize(): Promise<void>;
    generateReport(topic: string, context: any): Promise<AgentReport>;
    receiveResponse(response: any): void;
    processTask(taskId: string, task: any): Promise<TaskResult>;
    protected abstract performAnalysis(topic: string, context: any): Promise<any>;
    protected abstract formulateRecommendation(topic: string, context: any, analysis: any): Promise<any>;
    protected abstract executeTask(task: any): Promise<any>;
    protected abstract initializeCapabilities(): void;
    protected calculateTopicRelevance(topic: string, context: any): number;
    protected calculateConfidence(relevance: number, analysis: any): number;
    protected generateReasoning(analysis: any, confidence: number): string;
    protected isCapabilityRelevant(capability: string, topic: string, context: any): boolean;
    protected updatePerformanceMetrics(responseTime: number, confidence: number): void;
    protected handleTaskAssignment(response: any): void;
    protected handleFeedback(response: any): void;
    protected handleCollaborationRequest(response: any): void;
    protected processNextTask(): Promise<void>;
    protected learnFromTask(result: TaskResult): Promise<void>;
    protected learnFromFeedback(feedback: any): void;
    protected evaluateAccuracy(output: any, task: any): number;
    protected evaluateEfficiency(duration: number, task: any): number;
    protected handleError(error: any): void;
    getId(): string;
    getType(): string;
    getStatus(): string;
    getPerformance(): PerformanceMetrics;
    getCapabilities(): string[];
    setQueenConnection(queen: any): void;
}
//# sourceMappingURL=BaseAgent.d.ts.map