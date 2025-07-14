export { HITLSystem, type HITLSystemConfig, type HITLSystemStatus } from './HITLSystem';
export { HITLOrchestrator, type HITLDecision, type AgentRecommendation, type HITLConfiguration } from './core/HITLOrchestrator';
export { ReviewWorkflowEngine, type ReviewWorkflow, type WorkflowExecution, type ReviewStage } from './review/ReviewWorkflowEngine';
export { TaskDelegationManager, type DelegatedTask, type HumanOperator, type DelegationStrategy } from './delegation/TaskDelegationManager';
export { ProgressTracker, type ProgressSnapshot, type TrackingConfiguration, type SystemStatus } from './tracking/ProgressTracker';
export { SwarmIntegration, type HITLSwarmConfig, type SwarmDecisionRequest, type HITLResponse } from './integration/SwarmIntegration';
export { HumanInTheLoopManager, type HITLManager, type HumanReviewRequest } from './interfaces/hitl-manager';
export { HITLDemo, runHITLDemo } from './examples/HITLDemo';
export interface HITLSystemInitConfig {
    swarmMemory: any;
    swarmCoordinator: any;
    systemConfig?: Partial<HITLSystemConfig>;
}
export declare function createHITLSystem(config: HITLSystemInitConfig): Promise<HITLSystem>;
export declare function createDemoHITLSystem(): Promise<HITLSystem>;
export declare const HITLCapabilities: {
    readonly DECISION_ORCHESTRATION: "decision_orchestration";
    readonly TASK_DELEGATION: "task_delegation";
    readonly WORKFLOW_MANAGEMENT: "workflow_management";
    readonly PROGRESS_TRACKING: "progress_tracking";
    readonly SWARM_INTEGRATION: "swarm_integration";
    readonly LEARNING_ADAPTATION: "learning_adaptation";
    readonly EMERGENCY_OVERRIDE: "emergency_override";
    readonly REAL_TIME_MONITORING: "real_time_monitoring";
};
export declare const DefaultHITLConfig: HITLSystemConfig;
export declare const HITLQuickStart: {
    createBasicSystem: (swarmMemory: any, swarmCoordinator: any) => Promise<HITLSystem>;
    createProductionSystem: (swarmMemory: any, swarmCoordinator: any) => Promise<HITLSystem>;
    createDevelopmentSystem: (swarmMemory: any, swarmCoordinator: any) => Promise<HITLSystem>;
};
export declare const HITLUtils: {
    validateConfig: (config: Partial<HITLSystemConfig>) => boolean;
    generateHealthReport: (system: HITLSystem) => Promise<any>;
    generateHealthRecommendations: (status: HITLSystemStatus) => string[];
};
export declare const HITLConstants: {
    DEFAULT_CONFIDENCE_THRESHOLD: number;
    DEFAULT_AUTO_APPROVAL_THRESHOLD: number;
    DEFAULT_ESCALATION_THRESHOLD: number;
    DEFAULT_REVIEW_TIMEOUT_MINUTES: number;
    DEFAULT_FINANCIAL_IMPACT_THRESHOLD: number;
    PRIORITY_LEVELS: readonly ["low", "medium", "high", "critical"];
    RISK_LEVELS: readonly ["low", "medium", "high", "critical"];
    DECISION_TYPES: readonly ["strategic", "approval", "validation", "override", "escalation"];
    COMPONENT_NAMES: {
        readonly ORCHESTRATOR: "orchestrator";
        readonly DELEGATION: "delegation";
        readonly WORKFLOWS: "workflows";
        readonly TRACKING: "tracking";
        readonly SWARM_INTEGRATION: "swarmIntegration";
    };
};
export default HITLSystem;
//# sourceMappingURL=index.d.ts.map