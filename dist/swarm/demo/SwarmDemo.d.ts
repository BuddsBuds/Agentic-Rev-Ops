import { EventEmitter } from 'events';
export interface DemoScenario {
    name: string;
    description: string;
    topic: string;
    context: any;
    expectedOutcome: string;
}
export declare class SwarmDemo extends EventEmitter {
    private queen;
    private crmAgent;
    private marketingAgent;
    private analyticsAgent;
    private swarmId;
    constructor();
    initialize(): Promise<void>;
    runDemo(): Promise<void>;
    private runScenario;
    private showSwarmHealth;
    private setupEventListeners;
    private generateTimeSeriesData;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=SwarmDemo.d.ts.map