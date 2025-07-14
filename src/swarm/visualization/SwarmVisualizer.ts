/**
 * Swarm Visualizer
 * Simple console-based visualization of swarm activity
 */

export class SwarmVisualizer {
  private activeAgents: Map<string, AgentVisual>;
  private decisions: DecisionVisual[];
  private maxDecisions: number = 10;
  
  constructor() {
    this.activeAgents = new Map();
    this.decisions = [];
  }

  /**
   * Register an agent for visualization
   */
  registerAgent(agentId: string, type: string, name: string): void {
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

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: string, confidence?: number): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActivity = new Date();
      if (confidence !== undefined) {
        agent.confidence = confidence;
      }
    }
  }

  /**
   * Record a decision
   */
  recordDecision(decision: any): void {
    this.decisions.unshift({
      id: decision.id,
      type: decision.type,
      result: decision.decision,
      participation: decision.majority.participation.participationRate,
      timestamp: new Date()
    });
    
    // Keep only recent decisions
    if (this.decisions.length > this.maxDecisions) {
      this.decisions.pop();
    }
  }

  /**
   * Display swarm state
   */
  displaySwarmState(): void {
    console.clear();
    console.log(this.generateHeader());
    console.log(this.generateAgentStatus());
    console.log(this.generateDecisionHistory());
    console.log(this.generateActivityGraph());
  }

  /**
   * Generate header
   */
  private generateHeader(): string {
    const header = `
╔════════════════════════════════════════════════════════════╗
║                   🐝 SWARM OPERATIONS CENTER 🐝            ║
║                Revenue Operations Autonomous Swarm          ║
╚════════════════════════════════════════════════════════════╝
    `.trim();
    
    return header;
  }

  /**
   * Generate agent status display
   */
  private generateAgentStatus(): string {
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

  /**
   * Generate decision history
   */
  private generateDecisionHistory(): string {
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

  /**
   * Generate activity graph
   */
  private generateActivityGraph(): string {
    let output = '\n📈 SWARM ACTIVITY\n';
    output += '─'.repeat(60) + '\n';
    
    // const now = new Date(); // TODO: Use timestamp for activity data
    const activities = this.generateActivityData();
    
    // Simple ASCII graph
    const maxHeight = 5;
    const width = 20;
    
    for (let h = maxHeight; h > 0; h--) {
      let line = '│';
      for (let w = 0; w < width; w++) {
        if (activities[w] >= h) {
          line += '█';
        } else {
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

  /**
   * Get agent icon based on type
   */
  private getAgentIcon(type: string): string {
    const icons: Record<string, string> = {
      'queen': '👑',
      'crm-specialist': '🎯',
      'marketing-specialist': '📢',
      'analytics-specialist': '📊',
      'coordinator': '🎮',
      'default': '🤖'
    };
    
    return icons[type] || icons.default;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'idle': '⚪',
      'active': '🟢',
      'busy': '🟡',
      'error': '🔴',
      'offline': '⚫'
    };
    
    return icons[status] || '❓';
  }

  /**
   * Generate confidence bar
   */
  private generateConfidenceBar(confidence: number): string {
    const width = 20;
    const filled = Math.round(confidence * width);
    const empty = width - filled;
    
    return `[${' '.repeat(filled)}${'░'.repeat(empty)}] ${(confidence * 100).toFixed(0)}%`;
  }

  /**
   * Generate participation bar
   */
  private generateParticipationBar(participation: number): string {
    const width = 10;
    const filled = Math.round(participation * width);
    const empty = width - filled;
    
    return `${' '.repeat(filled)}${'░'.repeat(empty)}`;
  }

  /**
   * Get time ago string
   */
  private getTimeAgo(timestamp: Date): string {
    const seconds = Math.floor((new Date().getTime() - timestamp.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Truncate string
   */
  private truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
  }

  /**
   * Generate activity data for graph
   */
  private generateActivityData(): number[] {
    const data: number[] = [];
    const now = new Date().getTime();
    
    for (let i = 0; i < 20; i++) {
      let activity = 0;
      
      // Count activities in this time slot
      this.activeAgents.forEach(agent => {
        const agentTime = agent.lastActivity.getTime();
        const slotTime = now - (i * 60000); // 1 minute slots
        
        if (Math.abs(agentTime - slotTime) < 60000) {
          activity++;
        }
      });
      
      data.push(Math.min(activity, 5)); // Cap at 5 for display
    }
    
    return data.reverse();
  }

  /**
   * Create a status summary
   */
  getStatusSummary(): SwarmStatus {
    const agents = Array.from(this.activeAgents.values());
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active' || a.status === 'busy').length,
      recentDecisions: this.decisions.length,
      avgConfidence: agents.reduce((sum, a) => sum + a.confidence, 0) / agents.length,
      healthStatus: this.calculateHealthStatus()
    };
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(): string {
    const agents = Array.from(this.activeAgents.values());
    const activeRatio = agents.filter(a => a.status !== 'error' && a.status !== 'offline').length / agents.length;
    
    if (activeRatio >= 0.8) return 'Healthy';
    if (activeRatio >= 0.5) return 'Degraded';
    return 'Critical';
  }
}

// Type definitions
interface AgentVisual {
  id: string;
  type: string;
  name: string;
  status: string;
  lastActivity: Date;
  tasksCompleted: number;
  confidence: number;
}

interface DecisionVisual {
  id: string;
  type: string;
  result: string;
  participation: number;
  timestamp: Date;
}

interface SwarmStatus {
  totalAgents: number;
  activeAgents: number;
  recentDecisions: number;
  avgConfidence: number;
  healthStatus: string;
}