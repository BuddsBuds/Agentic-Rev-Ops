export declare class HITLDemo {
    private hitlSystem;
    private swarmMemory;
    private swarmCoordinator;
    private demoScenarios;
    constructor();
    private setupDemo;
    private getDemoConfiguration;
    private setupDemoScenarios;
    private setupDemoEventListeners;
    runDemo(): Promise<void>;
    runScenario(scenario: DemoScenario): Promise<void>;
    private registerDemoOperators;
    private runHighConfidenceScenario;
    private runMediumConfidenceScenario;
    private runLowConfidenceScenario;
    private runEmergencyScenario;
    private runComplexWorkflowScenario;
    private runTaskDelegationScenario;
    private runLearningScenario;
    private runMonitoringScenario;
    private showFinalStatus;
    private logSystemStatus;
    private sleep;
}
interface DemoScenario {
    id: string;
    name: string;
    description: string;
    type: string;
    execute: () => Promise<void>;
}
export declare function runHITLDemo(): Promise<void>;
export {};
//# sourceMappingURL=HITLDemo.d.ts.map