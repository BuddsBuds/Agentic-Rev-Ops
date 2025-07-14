// Workflow Scheduler Module - Enhanced with cron support and persistence
import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowEngine } from '../engine/workflow-engine';

export interface ScheduledWorkflow {
  id: string;
  workflowId: string;
  schedule: string | Date | ScheduleConfig;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  lastRun?: Date;
  nextRun?: Date;
}

export interface ScheduleConfig {
  type: 'cron' | 'interval' | 'once';
  value: string | number;
  timezone?: string;
}

export interface WorkflowScheduler {
  scheduleWorkflow(workflowId: string, schedule: string | Date | ScheduleConfig, context?: any): ScheduledWorkflow;
  cancelSchedule(scheduleId: string): void;
  pauseSchedule(scheduleId: string): void;
  resumeSchedule(scheduleId: string): void;
  getScheduledWorkflows(): ScheduledWorkflow[];
  getScheduleById(scheduleId: string): ScheduledWorkflow | undefined;
  updateSchedule(scheduleId: string, schedule: string | Date | ScheduleConfig): void;
  registerScheduledWorkflow(workflowId: string, schedule: any): ScheduledWorkflow;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getScheduleHistory(scheduleId: string): ScheduleExecutionHistory[];
}

export interface ScheduleExecutionHistory {
  scheduleId: string;
  workflowId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'success' | 'failed' | 'cancelled';
  error?: Error;
}

export class WorkflowSchedulerEngine extends EventEmitter implements WorkflowScheduler {
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private executionHistory: Map<string, ScheduleExecutionHistory[]> = new Map();
  private workflowEngine?: WorkflowEngine;
  private isInitialized: boolean = false;

  constructor(workflowEngine?: WorkflowEngine) {
    super();
    this.workflowEngine = workflowEngine;
  }

  public setWorkflowEngine(engine: WorkflowEngine): void {
    this.workflowEngine = engine;
  }

  scheduleWorkflow(workflowId: string, schedule: string | Date | ScheduleConfig, context?: any): ScheduledWorkflow {
    const scheduled: ScheduledWorkflow = {
      id: uuidv4(),
      workflowId,
      schedule,
      status: 'scheduled',
      context
    };

    this.scheduledWorkflows.set(scheduled.id, scheduled);
    this.executionHistory.set(scheduled.id, []);
    
    try {
      this.setupSchedule(scheduled);
      this.emit('workflow:scheduled', { scheduled, context });
    } catch (error) {
      this.scheduledWorkflows.delete(scheduled.id);
      this.executionHistory.delete(scheduled.id);
      throw error;
    }
    
    return scheduled;
  }

  cancelSchedule(scheduleId: string): void {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      return;
    }

    // Clear timers
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }

    // Stop cron jobs
    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduleId);
    }

    scheduled.status = 'cancelled';
    this.scheduledWorkflows.delete(scheduleId);
    this.emit('workflow:unscheduled', scheduled);
  }

  pauseSchedule(scheduleId: string): void {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled || scheduled.status !== 'scheduled') {
      return;
    }

    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.stop();
    }

    scheduled.status = 'paused';
    this.emit('schedule:paused', scheduled);
  }

  resumeSchedule(scheduleId: string): void {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled || scheduled.status !== 'paused') {
      return;
    }

    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.start();
    }

    scheduled.status = 'scheduled';
    this.emit('schedule:resumed', scheduled);
  }

  getScheduledWorkflows(): ScheduledWorkflow[] {
    return Array.from(this.scheduledWorkflows.values());
  }

  getScheduleById(scheduleId: string): ScheduledWorkflow | undefined {
    return this.scheduledWorkflows.get(scheduleId);
  }

  updateSchedule(scheduleId: string, schedule: string | Date | ScheduleConfig): void {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Cancel existing schedule
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }

    const cronJob = this.cronJobs.get(scheduleId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduleId);
    }

    // Update schedule
    scheduled.schedule = schedule;
    this.setupSchedule(scheduled);
    
    this.emit('schedule:updated', scheduled);
  }

  private setupSchedule(scheduled: ScheduledWorkflow): void {
    if (scheduled.schedule instanceof Date) {
      this.scheduleOnce(scheduled, scheduled.schedule);
    } else if (typeof scheduled.schedule === 'object') {
      this.scheduleByConfig(scheduled, scheduled.schedule);
    } else {
      // Assume cron string
      this.scheduleCron(scheduled, scheduled.schedule);
    }
  }

  private scheduleOnce(scheduled: ScheduledWorkflow, date: Date): void {
    const delay = date.getTime() - Date.now();
    if (delay <= 0) {
      this.runScheduledWorkflow(scheduled);
      return;
    }

    const timer = setTimeout(() => {
      this.runScheduledWorkflow(scheduled);
    }, delay);

    this.timers.set(scheduled.id, timer);
    scheduled.nextRun = date;
  }

  private scheduleByConfig(scheduled: ScheduledWorkflow, config: ScheduleConfig): void {
    switch (config.type) {
      case 'once':
        const date = new Date(config.value);
        this.scheduleOnce(scheduled, date);
        break;
      case 'interval':
        this.scheduleInterval(scheduled, config.value as number);
        break;
      case 'cron':
        this.scheduleCron(scheduled, config.value as string);
        break;
    }
  }

  private scheduleInterval(scheduled: ScheduledWorkflow, interval: number): void {
    const timer = setInterval(() => {
      this.runScheduledWorkflow(scheduled);
    }, interval);

    this.timers.set(scheduled.id, timer as any);
    scheduled.nextRun = new Date(Date.now() + interval);
  }

  private scheduleCron(scheduled: ScheduledWorkflow, cronExpression: string): void {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const task = cron.schedule(cronExpression, async () => {
      await this.runScheduledWorkflow(scheduled);
    }, {
      scheduled: true,
      timezone: typeof scheduled.schedule === 'object' && 
                scheduled.schedule.type === 'cron' && 
                scheduled.schedule.timezone || 'UTC'
    });

    this.cronJobs.set(scheduled.id, task);
    
    // Calculate next run time
    const nextRun = this.getNextCronRun(cronExpression);
    if (nextRun) {
      scheduled.nextRun = nextRun;
    }
  }

  private getNextCronRun(cronExpression: string): Date | undefined {
    try {
      // Parse cron expression to calculate next run
      // This is a simplified implementation
      const now = new Date();
      const parts = cronExpression.split(' ');
      
      // Basic parsing for common patterns
      if (parts[0] === '0' && parts[1] === '0' && parts[2] === '*') {
        // Daily at midnight
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        return next;
      } else if (parts[0] === '0' && parts[1] === '*') {
        // Every hour
        const next = new Date(now);
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        return next;
      }
      
      // For other patterns, approximate
      return new Date(Date.now() + 60000); // 1 minute from now
    } catch {
      return undefined;
    }
  }

  private async runScheduledWorkflow(scheduled: ScheduledWorkflow): Promise<void> {
    const executionId = uuidv4();
    const execution: ScheduleExecutionHistory = {
      scheduleId: scheduled.id,
      workflowId: scheduled.workflowId,
      executionId,
      startTime: new Date(),
      status: 'success'
    };

    scheduled.status = 'running';
    scheduled.lastRun = new Date();
    
    this.emit('workflow:run', { scheduled, executionId });
    
    try {
      if (this.workflowEngine) {
        // Execute the workflow using the engine
        const context = scheduled.context || {};
        await this.workflowEngine.executeWorkflow(scheduled.workflowId, {
          ...context,
          $schedule: {
            id: scheduled.id,
            lastRun: scheduled.lastRun,
            executionId
          }
        });
      } else {
        // Fallback: emit event for external execution
        this.emit('workflow:execute', { 
          workflowId: scheduled.workflowId, 
          scheduleId: scheduled.id,
          executionId,
          context: scheduled.context 
        });
        
        // Wait for external confirmation (simplified)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      execution.endTime = new Date();
      execution.status = 'success';
      
      // Update schedule status based on type
      if (scheduled.schedule instanceof Date || 
          (typeof scheduled.schedule === 'object' && scheduled.schedule.type === 'once')) {
        scheduled.status = 'completed';
      } else {
        scheduled.status = 'scheduled';
        // Update next run for recurring schedules
        this.updateNextRun(scheduled);
      }
      
      this.emit('workflow:complete', { scheduled, executionId });
      
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error : new Error(String(error));
      execution.endTime = new Date();
      
      scheduled.status = 'failed';
      this.emit('workflow:error', { scheduled, error, executionId });
    }
    
    // Store execution history
    const history = this.executionHistory.get(scheduled.id) || [];
    history.push(execution);
    this.executionHistory.set(scheduled.id, history);
  }

  private updateNextRun(scheduled: ScheduledWorkflow): void {
    const { schedule } = scheduled;
    
    if (typeof schedule === 'object') {
      switch (schedule.type) {
        case 'interval':
          scheduled.nextRun = new Date(Date.now() + (schedule.value as number));
          break;
        case 'cron':
          scheduled.nextRun = this.getNextCronRun(schedule.value as string);
          break;
      }
    }
  }

  registerScheduledWorkflow(workflowId: string, schedule: any): ScheduledWorkflow {
    return this.scheduleWorkflow(workflowId, schedule);
  }

  getScheduleHistory(scheduleId: string): ScheduleExecutionHistory[] {
    return this.executionHistory.get(scheduleId) || [];
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load persisted schedules if needed
      // This would typically load from a database
      
      // Start any active cron jobs
      for (const scheduled of this.scheduledWorkflows.values()) {
        if (scheduled.status === 'scheduled') {
          try {
            this.setupSchedule(scheduled);
          } catch (error) {
            this.emit('scheduler:error', { 
              scheduleId: scheduled.id, 
              error,
              message: 'Failed to restore schedule' 
            });
          }
        }
      }
      
      this.isInitialized = true;
      this.emit('scheduler:initialized', {
        scheduledCount: this.scheduledWorkflows.size,
        activeJobs: this.cronJobs.size
      });
      
    } catch (error) {
      this.emit('scheduler:error', { error, phase: 'initialization' });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
    
    // Stop all cron jobs
    for (const [id, job] of this.cronJobs.entries()) {
      job.stop();
      this.emit('scheduler:job-stopped', { scheduleId: id });
    }
    this.cronJobs.clear();
    
    // Clear all timers
    for (const [id, timer] of this.timers.entries()) {
      clearTimeout(timer);
      this.emit('scheduler:timer-cleared', { scheduleId: id });
    }
    this.timers.clear();
    
    // Mark all running schedules as cancelled
    for (const scheduled of this.scheduledWorkflows.values()) {
      if (scheduled.status === 'running') {
        scheduled.status = 'cancelled';
      }
    }
    
    this.emit('scheduler:shutdown', {
      scheduledWorkflows: this.scheduledWorkflows.size,
      executionHistory: Array.from(this.executionHistory.values())
        .reduce((total, history) => total + history.length, 0)
    });
  }
}

// Add interface extension for context
export interface ScheduledWorkflow {
  id: string;
  workflowId: string;
  schedule: string | Date | ScheduleConfig;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  lastRun?: Date;
  nextRun?: Date;
  context?: any;
}
}