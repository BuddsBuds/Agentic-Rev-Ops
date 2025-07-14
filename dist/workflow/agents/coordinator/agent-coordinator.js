"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoordinationEngine = void 0;
const events_1 = require("events");
class AgentCoordinationEngine extends events_1.EventEmitter {
    agents = new Map();
    tasks = new Map();
    agentTasks = new Map();
    registerAgent(agent) {
        this.agents.set(agent.id, agent);
        this.agentTasks.set(agent.id, new Set());
        this.emit('agent:registered', agent);
    }
    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return;
        }
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
    async assignTask(task) {
        this.tasks.set(task.id, task);
        const agent = this.findBestAgent(task);
        if (!agent) {
            throw new Error('No suitable agent available');
        }
        task.assignedTo = agent.id;
        task.status = 'assigned';
        const agentTaskSet = this.agentTasks.get(agent.id) || new Set();
        agentTaskSet.add(task.id);
        agent.status = 'busy';
        this.emit('task:assigned', { task, agent });
        this.executeTask(task, agent);
        return agent;
    }
    getAgents() {
        return Array.from(this.agents.values());
    }
    getAgentWorkload(agentId) {
        const taskIds = this.agentTasks.get(agentId) || new Set();
        const tasks = [];
        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task) {
                tasks.push(task);
            }
        }
        return tasks;
    }
    findBestAgent(task) {
        let bestAgent = null;
        let minWorkload = Infinity;
        for (const agent of this.agents.values()) {
            if (agent.status === 'offline') {
                continue;
            }
            if (!this.agentCanHandleTask(agent, task)) {
                continue;
            }
            const workload = (this.agentTasks.get(agent.id) || new Set()).size;
            if (workload < minWorkload) {
                minWorkload = workload;
                bestAgent = agent;
            }
        }
        return bestAgent;
    }
    agentCanHandleTask(agent, task) {
        return agent.capabilities.includes(task.type) || agent.capabilities.includes('*');
    }
    async executeTask(task, agent) {
        task.status = 'in_progress';
        this.emit('task:start', { task, agent });
        try {
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            task.status = 'completed';
            this.emit('task:complete', { task, agent });
            const agentTasks = this.agentTasks.get(agent.id) || new Set();
            agentTasks.delete(task.id);
            if (agentTasks.size === 0) {
                agent.status = 'idle';
            }
        }
        catch (error) {
            task.status = 'failed';
            this.emit('task:error', { task, agent, error });
        }
    }
    async initialize() {
        this.emit('coordinator:initialized');
    }
}
exports.AgentCoordinationEngine = AgentCoordinationEngine;
//# sourceMappingURL=agent-coordinator.js.map