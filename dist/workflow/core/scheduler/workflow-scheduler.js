"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSchedulerEngine = void 0;
const events_1 = require("events");
const cron = __importStar(require("node-cron"));
const uuid_1 = require("uuid");
class WorkflowSchedulerEngine extends events_1.EventEmitter {
    scheduledWorkflows = new Map();
    timers = new Map();
    cronJobs = new Map();
    executionHistory = new Map();
    workflowEngine;
    isInitialized = false;
    constructor(workflowEngine) {
        super();
        this.workflowEngine = workflowEngine;
    }
    setWorkflowEngine(engine) {
        this.workflowEngine = engine;
    }
    scheduleWorkflow(workflowId, schedule, context) {
        const scheduled = {
            id: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            this.scheduledWorkflows.delete(scheduled.id);
            this.executionHistory.delete(scheduled.id);
            throw error;
        }
        return scheduled;
    }
    cancelSchedule(scheduleId) {
        const scheduled = this.scheduledWorkflows.get(scheduleId);
        if (!scheduled) {
            return;
        }
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
        scheduled.status = 'cancelled';
        this.scheduledWorkflows.delete(scheduleId);
        this.emit('workflow:unscheduled', scheduled);
    }
    pauseSchedule(scheduleId) {
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
    resumeSchedule(scheduleId) {
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
    getScheduledWorkflows() {
        return Array.from(this.scheduledWorkflows.values());
    }
    getScheduleById(scheduleId) {
        return this.scheduledWorkflows.get(scheduleId);
    }
    updateSchedule(scheduleId, schedule) {
        const scheduled = this.scheduledWorkflows.get(scheduleId);
        if (!scheduled) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }
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
        scheduled.schedule = schedule;
        this.setupSchedule(scheduled);
        this.emit('schedule:updated', scheduled);
    }
    setupSchedule(scheduled) {
        if (scheduled.schedule instanceof Date) {
            this.scheduleOnce(scheduled, scheduled.schedule);
        }
        else if (typeof scheduled.schedule === 'object') {
            this.scheduleByConfig(scheduled, scheduled.schedule);
        }
        else {
            this.scheduleCron(scheduled, scheduled.schedule);
        }
    }
    scheduleOnce(scheduled, date) {
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
    scheduleByConfig(scheduled, config) {
        switch (config.type) {
            case 'once':
                const date = new Date(config.value);
                this.scheduleOnce(scheduled, date);
                break;
            case 'interval':
                this.scheduleInterval(scheduled, config.value);
                break;
            case 'cron':
                this.scheduleCron(scheduled, config.value);
                break;
        }
    }
    scheduleInterval(scheduled, interval) {
        const timer = setInterval(() => {
            this.runScheduledWorkflow(scheduled);
        }, interval);
        this.timers.set(scheduled.id, timer);
        scheduled.nextRun = new Date(Date.now() + interval);
    }
    scheduleCron(scheduled, cronExpression) {
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
        const nextRun = this.getNextCronRun(cronExpression);
        if (nextRun) {
            scheduled.nextRun = nextRun;
        }
    }
    getNextCronRun(cronExpression) {
        try {
            const now = new Date();
            const parts = cronExpression.split(' ');
            if (parts[0] === '0' && parts[1] === '0' && parts[2] === '*') {
                const next = new Date(now);
                next.setDate(next.getDate() + 1);
                next.setHours(0, 0, 0, 0);
                return next;
            }
            else if (parts[0] === '0' && parts[1] === '*') {
                const next = new Date(now);
                next.setHours(next.getHours() + 1);
                next.setMinutes(0, 0, 0);
                return next;
            }
            return new Date(Date.now() + 60000);
        }
        catch {
            return undefined;
        }
    }
    async runScheduledWorkflow(scheduled) {
        const executionId = (0, uuid_1.v4)();
        const execution = {
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
                const context = scheduled.context || {};
                await this.workflowEngine.executeWorkflow(scheduled.workflowId, {
                    ...context,
                    $schedule: {
                        id: scheduled.id,
                        lastRun: scheduled.lastRun,
                        executionId
                    }
                });
            }
            else {
                this.emit('workflow:execute', {
                    workflowId: scheduled.workflowId,
                    scheduleId: scheduled.id,
                    executionId,
                    context: scheduled.context
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            execution.endTime = new Date();
            execution.status = 'success';
            if (scheduled.schedule instanceof Date ||
                (typeof scheduled.schedule === 'object' && scheduled.schedule.type === 'once')) {
                scheduled.status = 'completed';
            }
            else {
                scheduled.status = 'scheduled';
                this.updateNextRun(scheduled);
            }
            this.emit('workflow:complete', { scheduled, executionId });
        }
        catch (error) {
            execution.status = 'failed';
            execution.error = error instanceof Error ? error : new Error(String(error));
            execution.endTime = new Date();
            scheduled.status = 'failed';
            this.emit('workflow:error', { scheduled, error, executionId });
        }
        const history = this.executionHistory.get(scheduled.id) || [];
        history.push(execution);
        this.executionHistory.set(scheduled.id, history);
    }
    updateNextRun(scheduled) {
        const { schedule } = scheduled;
        if (typeof schedule === 'object') {
            switch (schedule.type) {
                case 'interval':
                    scheduled.nextRun = new Date(Date.now() + schedule.value);
                    break;
                case 'cron':
                    scheduled.nextRun = this.getNextCronRun(schedule.value);
                    break;
            }
        }
    }
    registerScheduledWorkflow(workflowId, schedule) {
        return this.scheduleWorkflow(workflowId, schedule);
    }
    getScheduleHistory(scheduleId) {
        return this.executionHistory.get(scheduleId) || [];
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            for (const scheduled of this.scheduledWorkflows.values()) {
                if (scheduled.status === 'scheduled') {
                    try {
                        this.setupSchedule(scheduled);
                    }
                    catch (error) {
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
        }
        catch (error) {
            this.emit('scheduler:error', { error, phase: 'initialization' });
            throw error;
        }
    }
    async shutdown() {
        this.isInitialized = false;
        for (const [id, job] of this.cronJobs.entries()) {
            job.stop();
            this.emit('scheduler:job-stopped', { scheduleId: id });
        }
        this.cronJobs.clear();
        for (const [id, timer] of this.timers.entries()) {
            clearTimeout(timer);
            this.emit('scheduler:timer-cleared', { scheduleId: id });
        }
        this.timers.clear();
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
exports.WorkflowSchedulerEngine = WorkflowSchedulerEngine;
//# sourceMappingURL=workflow-scheduler.js.map