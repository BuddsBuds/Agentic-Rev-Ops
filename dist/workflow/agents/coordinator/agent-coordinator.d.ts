import { EventEmitter } from 'events';
export interface Agent {
    id: string;
    name: string;
    type: string;
    status: 'idle' | 'busy' | 'offline';
    capabilities: string[];
}
export interface Task {
    id: string;
    type: string;
    priority: number;
    data: any;
    assignedTo?: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
}
export interface AgentCoordinator {
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): void;
    assignTask(task: Task): Promise<Agent>;
    getAgents(): Agent[];
    getAgentWorkload(agentId: string): Task[];
    initialize(): Promise<void>;
}
export declare class AgentCoordinationEngine extends EventEmitter implements AgentCoordinator {
    private agents;
    private tasks;
    private agentTasks;
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): void;
    assignTask(task: Task): Promise<Agent>;
    getAgents(): Agent[];
    getAgentWorkload(agentId: string): Task[];
    private findBestAgent;
    private agentCanHandleTask;
    private executeTask;
    initialize(): Promise<void>;
}
//# sourceMappingURL=agent-coordinator.d.ts.map