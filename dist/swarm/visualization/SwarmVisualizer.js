"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmVisualizer = void 0;
class SwarmVisualizer {
    activeAgents;
    decisions;
    maxDecisions = 10;
    constructor() {
        this.activeAgents = new Map();
        this.decisions = [];
    }
    registerAgent(agentId, type, name) {
        this.activeAgents.set(agentId, {
            id: agentId,
            type,
            name,
            status: 'idle',
            lastActivity: new Date(),
            tasksCompleted: 0,
            confidence: 0
        });
    }
    updateAgentStatus(agentId, status, confidence) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            agent.status = status;
            agent.lastActivity = new Date();
            if (confidence !== undefined) {
                agent.confidence = confidence;
            }
        }
    }
    recordDecision(decision) {
        this.decisions.unshift({
            id: decision.id,
            type: decision.type,
            result: decision.decision,
            participation: decision.majority.participation.participationRate,
            timestamp: new Date()
        });
        if (this.decisions.length > this.maxDecisions) {
            this.decisions.pop();
        }
    }
    displaySwarmState() {
        console.clear();
        console.log(this.generateHeader());
        console.log(this.generateAgentStatus());
        console.log(this.generateDecisionHistory());
        console.log(this.generateActivityGraph());
    }
    generateHeader() {
        const header = `
╔════════════════════════════════════════════════════════════╗
║                   🐝 SWARM OPERATIONS CENTER 🐝            ║
║                Revenue Operations Autonomous Swarm          ║
╚════════════════════════════════════════════════════════════╝
    `.trim();
        return header;
    }
    generateAgentStatus() {
        let output = '\n📊 AGENT STATUS\n';
        output += '─'.repeat(60) + '\n';
        const agents = Array.from(this.activeAgents.values());
        agents.forEach(agent => {
            const icon = this.getAgentIcon(agent.type);
            const statusIcon = this.getStatusIcon(agent.status);
            const confidenceBar = this.generateConfidenceBar(agent.confidence);
            output += `${icon} ${agent.name.padEnd(25)} ${statusIcon} ${agent.status.padEnd(10)} ${confidenceBar}\n`;
        });
        return output;
    }
    generateDecisionHistory() {
        let output = '\n📋 RECENT DECISIONS\n';
        output += '─'.repeat(60) + '\n';
        if (this.decisions.length === 0) {
            output += 'No decisions yet...\n';
            return output;
        }
        this.decisions.slice(0, 5).forEach(decision => {
            const timeAgo = this.getTimeAgo(decision.timestamp);
            const participationBar = this.generateParticipationBar(decision.participation);
            output += `• ${decision.type.padEnd(12)} │ ${participationBar} │ ${timeAgo}\n`;
            output += `  └─ ${this.truncate(decision.result, 50)}\n`;
        });
        return output;
    }
    generateActivityGraph() {
        let output = '\n📈 SWARM ACTIVITY\n';
        output += '─'.repeat(60) + '\n';
        const activities = this.generateActivityData();
        const maxHeight = 5;
        const width = 20;
        for (let h = maxHeight; h > 0; h--) {
            let line = '│';
            for (let w = 0; w < width; w++) {
                if (activities[w] >= h) {
                    line += '█';
                }
                else {
                    line += ' ';
                }
            }
            line += '│';
            output += line + '\n';
        }
        output += '└' + '─'.repeat(width) + '┘\n';
        output += ' Past                     Now\n';
        return output;
    }
    getAgentIcon(type) {
        const icons = {
            'queen': '👑',
            'crm-specialist': '🎯',
            'marketing-specialist': '📢',
            'analytics-specialist': '📊',
            'coordinator': '🎮',
            'default': '🤖'
        };
        return icons[type] || icons.default;
    }
    getStatusIcon(status) {
        const icons = {
            'idle': '⚪',
            'active': '🟢',
            'busy': '🟡',
            'error': '🔴',
            'offline': '⚫'
        };
        return icons[status] || '❓';
    }
    generateConfidenceBar(confidence) {
        const width = 20;
        const filled = Math.round(confidence * width);
        const empty = width - filled;
        return `[${' '.repeat(filled)}${'░'.repeat(empty)}] ${(confidence * 100).toFixed(0)}%`;
    }
    generateParticipationBar(participation) {
        const width = 10;
        const filled = Math.round(participation * width);
        const empty = width - filled;
        return `${' '.repeat(filled)}${'░'.repeat(empty)}`;
    }
    getTimeAgo(timestamp) {
        const seconds = Math.floor((new Date().getTime() - timestamp.getTime()) / 1000);
        if (seconds < 60)
            return `${seconds}s ago`;
        if (seconds < 3600)
            return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400)
            return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
    truncate(str, length) {
        if (str.length <= length)
            return str;
        return str.substring(0, length - 3) + '...';
    }
    generateActivityData() {
        const data = [];
        const now = new Date().getTime();
        for (let i = 0; i < 20; i++) {
            let activity = 0;
            this.activeAgents.forEach(agent => {
                const agentTime = agent.lastActivity.getTime();
                const slotTime = now - (i * 60000);
                if (Math.abs(agentTime - slotTime) < 60000) {
                    activity++;
                }
            });
            data.push(Math.min(activity, 5));
        }
        return data.reverse();
    }
    getStatusSummary() {
        const agents = Array.from(this.activeAgents.values());
        return {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.status === 'active' || a.status === 'busy').length,
            recentDecisions: this.decisions.length,
            avgConfidence: agents.reduce((sum, a) => sum + a.confidence, 0) / agents.length,
            healthStatus: this.calculateHealthStatus()
        };
    }
    calculateHealthStatus() {
        const agents = Array.from(this.activeAgents.values());
        const activeRatio = agents.filter(a => a.status !== 'error' && a.status !== 'offline').length / agents.length;
        if (activeRatio >= 0.8)
            return 'Healthy';
        if (activeRatio >= 0.5)
            return 'Degraded';
        return 'Critical';
    }
}
exports.SwarmVisualizer = SwarmVisualizer;
//# sourceMappingURL=SwarmVisualizer.js.map