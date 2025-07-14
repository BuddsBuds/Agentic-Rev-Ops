// Agent Coordinator Module
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

export class AgentCoordinationEngine extends EventEmitter implements AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private agentTasks: Map<string, Set<string>> = new Map();

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.agentTasks.set(agent.id, new Set());
    this.emit('agent:registered', agent);
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    // Reassign tasks from this agent
    const tasks = this.agentTasks.get(agentId) || new Set();
    for (const taskId of tasks) {
      const task = this.tasks.get(taskId);
      if (task && task.status !== 'completed') {
        task.assignedTo = undefined;
        task.status = 'pending';
        this.emit('task:unassigned', task);
      }
    }

    this.agents.delete(agentId);
    this.agentTasks.delete(agentId);
    this.emit('agent:unregistered', agent);
  }

  async assignTask(task: Task): Promise<Agent> {
    this.tasks.set(task.id, task);
    
    // Find the best agent for this task
    const agent = this.findBestAgent(task);
    if (!agent) {
      throw new Error('No suitable agent available');
    }

    // Assign the task
    task.assignedTo = agent.id;
    task.status = 'assigned';
    
    const agentTaskSet = this.agentTasks.get(agent.id) || new Set();
    agentTaskSet.add(task.id);
    
    agent.status = 'busy';
    
    this.emit('task:assigned', { task, agent });
    
    // Simulate task execution
    this.executeTask(task, agent);
    
    return agent;
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentWorkload(agentId: string): Task[] {
    const taskIds = this.agentTasks.get(agentId) || new Set();
    const tasks: Task[] = [];
    
    for (const taskId of taskIds) {
      const task = this.tasks.get(taskId);
      if (task) {
        tasks.push(task);
      }
    }
    
    return tasks;
  }

  private findBestAgent(task: Task): Agent | null {
    let bestAgent: Agent | null = null;
    let minWorkload = Infinity;

    for (const agent of this.agents.values()) {
      if (agent.status === 'offline') {
        continue;
      }

      // Check if agent has required capabilities
      if (!this.agentCanHandleTask(agent, task)) {
        continue;
      }

      // Check workload
      const workload = (this.agentTasks.get(agent.id) || new Set()).size;
      if (workload < minWorkload) {
        minWorkload = workload;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  private agentCanHandleTask(agent: Agent, task: Task): boolean {
    // Simple capability matching
    return agent.capabilities.includes(task.type) || agent.capabilities.includes('*');
  }

  private async executeTask(task: Task, agent: Agent): Promise<void> {
    task.status = 'in_progress';
    this.emit('task:start', { task, agent });

    try {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      task.status = 'completed';
      this.emit('task:complete', { task, agent });
      
      // Update agent status
      const agentTasks = this.agentTasks.get(agent.id) || new Set();
      agentTasks.delete(task.id);
      
      if (agentTasks.size === 0) {
        agent.status = 'idle';
      }
    } catch (error) {
      task.status = 'failed';
      this.emit('task:error', { task, agent, error });
    }
  }

  async initialize(): Promise<void> {
    // Initialize coordinator components
    this.emit('coordinator:initialized');
  }
}