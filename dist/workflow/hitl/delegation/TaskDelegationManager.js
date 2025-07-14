"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskDelegationManager = void 0;
const events_1 = require("events");
class TaskDelegationManager extends events_1.EventEmitter {
    tasks = new Map();
    operators = new Map();
    strategies = new Map();
    swarmMemory;
    assignmentQueue = [];
    processingInterval;
    constructor(swarmMemory) {
        super();
        this.swarmMemory = swarmMemory;
        this.setupDefaultStrategies();
        this.startProcessing();
    }
    setupDefaultStrategies() {
        this.addStrategy({
            id: 'expert-tasks',
            name: 'Expert Task Assignment',
            description: 'Assign complex tasks to senior experts',
            rules: [
                {
                    condition: "task.complexity === 'expert'",
                    action: 'assign_to_role',
                    parameters: { role: 'senior-specialist', requireApproval: true },
                    weight: 10
                },
                {
                    condition: "task.priority === 'critical'",
                    action: 'assign_to_person',
                    parameters: { selectBest: true, notifyManager: true },
                    weight: 9
                }
            ],
            priority: 1,
            active: true
        });
        this.addStrategy({
            id: 'load-balancing',
            name: 'Workload Distribution',
            description: 'Distribute tasks based on current workload',
            rules: [
                {
                    condition: "operator.workload < 0.7",
                    action: 'assign_to_person',
                    parameters: { considerWorkload: true },
                    weight: 5
                },
                {
                    condition: "task.estimatedDuration > 120 && operator.workload > 0.8",
                    action: 'split_task',
                    parameters: { maxSubtasks: 3 },
                    weight: 7
                }
            ],
            priority: 2,
            active: true
        });
        this.addStrategy({
            id: 'skill-matching',
            name: 'Skill-Based Assignment',
            description: 'Match tasks to operators based on skills',
            rules: [
                {
                    condition: "intersection(task.requiredSkills, operator.skills).length >= task.requiredSkills.length * 0.8",
                    action: 'assign_to_person',
                    parameters: { skillMatch: true },
                    weight: 8
                }
            ],
            priority: 3,
            active: true
        });
    }
    async delegateFromDecision(decision, taskType, customInstructions) {
        const task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: customInstructions?.title || `Review: ${decision.title}`,
            description: customInstructions?.description || decision.description,
            type: taskType,
            priority: this.mapPriorityFromDecision(decision),
            status: 'pending',
            estimatedDuration: this.estimateTaskDuration(taskType, decision),
            deadline: this.calculateDeadline(decision),
            requiredSkills: this.determineRequiredSkills(taskType, decision),
            requiredRole: this.determineRequiredRole(taskType, decision),
            complexity: this.assessComplexity(decision),
            originatingDecision: decision.id,
            delegatedBy: 'hitl-orchestrator',
            delegatedAt: new Date(),
            inputs: {
                decision,
                swarmRecommendations: decision.context.recommendations,
                context: decision.context,
                metadata: decision.metadata
            },
            expectedOutputs: this.generateExpectedOutputs(taskType, decision),
            context: this.buildTaskContext(decision),
            instructions: this.generateInstructions(taskType, decision),
            resources: this.gatherResources(decision),
            progress: 0,
            milestones: this.generateMilestones(taskType, decision),
            timeSpent: 0,
            qualityChecks: this.generateQualityChecks(taskType),
            reviewRequired: this.shouldRequireReview(taskType, decision),
            metadata: {
                clientId: decision.metadata.clientId,
                projectId: decision.metadata.projectId,
                tags: [...decision.metadata.tags, 'delegated', taskType],
                urgencyReason: this.determineUrgencyReason(decision),
                escalationPath: this.buildEscalationPath(decision)
            },
            ...customInstructions
        };
        this.tasks.set(task.id, task);
        this.assignmentQueue.push(task.id);
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:created', task);
        return task;
    }
    async createTask(taskData) {
        const task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            priority: 'medium',
            status: 'pending',
            estimatedDuration: 60,
            requiredSkills: [],
            requiredRole: 'analyst',
            complexity: 'moderate',
            delegatedBy: 'system',
            delegatedAt: new Date(),
            inputs: {},
            expectedOutputs: [],
            context: {
                background: '',
                goals: [],
                constraints: [],
                stakeholders: [],
                relatedTasks: [],
                dependencies: [],
                risks: [],
                successCriteria: []
            },
            instructions: [],
            resources: [],
            progress: 0,
            milestones: [],
            timeSpent: 0,
            qualityChecks: [],
            reviewRequired: false,
            metadata: {
                tags: [],
                escalationPath: []
            },
            ...taskData
        };
        this.tasks.set(task.id, task);
        this.assignmentQueue.push(task.id);
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:created', task);
        return task;
    }
    registerOperator(operator) {
        this.operators.set(operator.id, operator);
        this.emit('operator:registered', operator);
    }
    updateOperatorStatus(operatorId, status) {
        const operator = this.operators.get(operatorId);
        if (operator) {
            operator.status = status;
            this.emit('operator:statusChanged', { operator, status });
        }
    }
    startProcessing() {
        this.processingInterval = setInterval(() => {
            this.processAssignmentQueue();
        }, 5000);
    }
    async processAssignmentQueue() {
        while (this.assignmentQueue.length > 0) {
            const taskId = this.assignmentQueue.shift();
            if (!taskId)
                continue;
            const task = this.tasks.get(taskId);
            if (!task || task.status !== 'pending')
                continue;
            try {
                await this.assignTask(task);
            }
            catch (error) {
                this.emit('assignment:failed', { task, error });
                this.assignmentQueue.push(taskId);
                break;
            }
        }
    }
    async assignTask(task) {
        const bestOperator = this.findBestOperator(task);
        if (!bestOperator) {
            await this.escalateTaskAssignment(task);
            return;
        }
        task.assignedTo = bestOperator.id;
        task.assignedAt = new Date();
        task.status = 'assigned';
        bestOperator.workload += this.calculateWorkloadImpact(task);
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        await this.swarmMemory.store(`delegation:operator:${bestOperator.id}`, bestOperator);
        this.emit('task:assigned', { task, operator: bestOperator });
    }
    findBestOperator(task) {
        const availableOperators = Array.from(this.operators.values()).filter(op => op.status === 'available' &&
            this.isOperatorEligible(op, task));
        if (availableOperators.length === 0)
            return null;
        const scoredOperators = availableOperators.map(operator => ({
            operator,
            score: this.scoreOperatorForTask(operator, task)
        }));
        scoredOperators.sort((a, b) => b.score - a.score);
        return scoredOperators[0].operator;
    }
    isOperatorEligible(operator, task) {
        if (task.requiredRole && operator.role !== task.requiredRole) {
            return false;
        }
        if (operator.workload >= 1.0) {
            return false;
        }
        const hasRequiredSkills = task.requiredSkills.every(skill => operator.skills.includes(skill) || operator.expertise.includes(skill));
        if (!hasRequiredSkills) {
            return false;
        }
        if (!this.isOperatorAvailableForTask(operator, task)) {
            return false;
        }
        return true;
    }
    scoreOperatorForTask(operator, task) {
        let score = 0;
        const skillMatchRatio = task.requiredSkills.filter(skill => operator.skills.includes(skill) || operator.expertise.includes(skill)).length / Math.max(task.requiredSkills.length, 1);
        score += skillMatchRatio * 30;
        score += operator.performance.completionRate * 25;
        score += (1 - operator.workload) * 20;
        score += (operator.performance.averageQuality / 5) * 15;
        const timeEfficiency = Math.min(1 / operator.performance.averageTime, 1);
        score += timeEfficiency * 10;
        return score;
    }
    isOperatorAvailableForTask(operator, task) {
        const now = new Date();
        const taskEnd = new Date(now.getTime() + task.estimatedDuration * 60000);
        const isOnVacation = operator.availability.vacationDates.some(vacation => vacation >= now && vacation <= taskEnd);
        if (isOnVacation)
            return false;
        const currentHour = now.getHours();
        const startHour = parseInt(operator.availability.workingHours.start.split(':')[0]);
        const endHour = parseInt(operator.availability.workingHours.end.split(':')[0]);
        if (currentHour < startHour || currentHour >= endHour) {
            if (task.priority === 'critical')
                return false;
        }
        const currentDay = now.getDay();
        if (!operator.availability.workingDays.includes(currentDay)) {
            if (task.priority === 'critical')
                return false;
        }
        return true;
    }
    async startTask(taskId, operatorId) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new Error(`Task ${taskId} not found`);
        if (task.assignedTo !== operatorId) {
            throw new Error(`Task ${taskId} is not assigned to operator ${operatorId}`);
        }
        task.status = 'in_progress';
        task.startedAt = new Date();
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:started', { task, operatorId });
    }
    async updateTaskProgress(taskId, progress, notes) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new Error(`Task ${taskId} not found`);
        task.progress = Math.max(0, Math.min(100, progress));
        if (notes) {
            if (!task.feedback)
                task.feedback = '';
            task.feedback += `\n[${new Date().toISOString()}] ${notes}`;
        }
        this.checkMilestoneCompletion(task);
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:progressUpdated', { task, progress, notes });
    }
    async completeTask(taskId, outputs, feedback, lessons) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new Error(`Task ${taskId} not found`);
        task.status = 'completed';
        task.completedAt = new Date();
        task.progress = 100;
        task.outputs = outputs;
        if (feedback)
            task.feedback = feedback;
        if (lessons)
            task.lessons = lessons;
        if (task.startedAt) {
            task.timeSpent = Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 60000);
        }
        if (task.assignedTo) {
            const operator = this.operators.get(task.assignedTo);
            if (operator) {
                operator.workload -= this.calculateWorkloadImpact(task);
                operator.workload = Math.max(0, operator.workload);
                this.updateOperatorPerformance(operator, task);
            }
        }
        await this.runQualityChecks(task);
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:completed', { task });
        if (task.originatingDecision) {
            this.emit('decision:taskCompleted', {
                decisionId: task.originatingDecision,
                task,
                outputs
            });
        }
    }
    async escalateTaskAssignment(task) {
        task.metadata.tags.push('assignment-escalated');
        for (const role of task.metadata.escalationPath) {
            const escalationOperators = Array.from(this.operators.values()).filter(op => op.role === role && op.status === 'available');
            if (escalationOperators.length > 0) {
                task.requiredRole = role;
                task.priority = this.increasePriority(task.priority);
                this.assignmentQueue.unshift(task.id);
                this.emit('task:escalated', { task, escalatedTo: role });
                return;
            }
        }
        task.status = 'failed';
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:assignmentFailed', { task });
    }
    mapPriorityFromDecision(decision) {
        return decision.metadata.priority;
    }
    estimateTaskDuration(type, decision) {
        const baseDurations = {
            analysis: 120,
            validation: 60,
            decision: 30,
            execution: 180,
            review: 45,
            research: 240
        };
        let duration = baseDurations[type];
        const complexity = this.assessComplexity(decision);
        const complexityMultipliers = {
            simple: 0.7,
            moderate: 1.0,
            complex: 1.5,
            expert: 2.0
        };
        duration *= complexityMultipliers[complexity];
        if (decision.metadata.priority === 'critical')
            duration *= 0.8;
        if (decision.metadata.priority === 'low')
            duration *= 1.2;
        return Math.round(duration);
    }
    calculateDeadline(decision) {
        if (decision.metadata.priority === 'critical') {
            return new Date(Date.now() + 4 * 60 * 60 * 1000);
        }
        if (decision.metadata.priority === 'high') {
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        if (decision.metadata.priority === 'medium') {
            return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    determineRequiredSkills(type, decision) {
        const baseSkills = {
            analysis: ['data-analysis', 'critical-thinking'],
            validation: ['attention-to-detail', 'domain-knowledge'],
            decision: ['strategic-thinking', 'risk-assessment'],
            execution: ['project-management', 'implementation'],
            review: ['quality-assurance', 'communication'],
            research: ['research-methods', 'information-synthesis']
        };
        const skills = [...baseSkills[type]];
        if (decision.metadata.clientId)
            skills.push('client-management');
        if (decision.context.financialImpact && decision.context.financialImpact > 10000) {
            skills.push('financial-analysis');
        }
        if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') {
            skills.push('risk-management');
        }
        return skills;
    }
    determineRequiredRole(type, decision) {
        if (decision.context.riskLevel === 'critical')
            return 'senior-manager';
        if (decision.context.financialImpact && decision.context.financialImpact > 50000)
            return 'manager';
        const roleMap = {
            analysis: 'analyst',
            validation: 'specialist',
            decision: 'manager',
            execution: 'coordinator',
            review: 'reviewer',
            research: 'researcher'
        };
        return roleMap[type];
    }
    assessComplexity(decision) {
        let complexityScore = 0;
        if (decision.context.recommendations.length > 5)
            complexityScore += 1;
        if (decision.context.financialImpact && decision.context.financialImpact > 100000)
            complexityScore += 2;
        if (decision.context.riskLevel === 'high')
            complexityScore += 1;
        if (decision.context.riskLevel === 'critical')
            complexityScore += 2;
        if (decision.context.stakeholders.length > 3)
            complexityScore += 1;
        if (decision.type === 'strategic')
            complexityScore += 2;
        if (complexityScore >= 6)
            return 'expert';
        if (complexityScore >= 4)
            return 'complex';
        if (complexityScore >= 2)
            return 'moderate';
        return 'simple';
    }
    generateExpectedOutputs(type, decision) {
        const outputs = [];
        switch (type) {
            case 'analysis':
                outputs.push({
                    id: 'analysis-report',
                    name: 'Analysis Report',
                    type: 'analysis',
                    format: 'document',
                    required: true,
                    description: 'Detailed analysis with findings and recommendations',
                    validationCriteria: ['Clear methodology', 'Evidence-based conclusions', 'Actionable recommendations']
                });
                break;
            case 'decision':
                outputs.push({
                    id: 'decision-outcome',
                    name: 'Decision Outcome',
                    type: 'decision',
                    format: 'structured',
                    required: true,
                    description: 'Final decision with rationale and implementation plan',
                    validationCriteria: ['Clear decision statement', 'Justified rationale', 'Implementation roadmap']
                });
                break;
            case 'validation':
                outputs.push({
                    id: 'validation-result',
                    name: 'Validation Result',
                    type: 'approval',
                    format: 'structured',
                    required: true,
                    description: 'Validation outcome with approval/rejection and reasoning',
                    validationCriteria: ['Clear outcome', 'Detailed reasoning', 'Quality assessment']
                });
                break;
        }
        return outputs;
    }
    buildTaskContext(decision) {
        return {
            background: `HITL decision requiring human intervention: ${decision.description}`,
            goals: [
                'Review AI recommendations',
                'Provide human judgment',
                'Ensure quality and accuracy',
                'Make final decision'
            ],
            constraints: [
                `Priority: ${decision.metadata.priority}`,
                `Risk level: ${decision.context.riskLevel}`,
                decision.context.financialImpact ? `Financial impact: $${decision.context.financialImpact}` : '',
                `Timeline: ${decision.context.timeframe}`
            ].filter(Boolean),
            stakeholders: decision.context.stakeholders,
            relatedTasks: [],
            dependencies: [],
            risks: [
                'Incorrect decision could impact business',
                'Delay could affect timelines',
                'Quality issues could damage reputation'
            ],
            successCriteria: [
                'Decision made within timeframe',
                'Quality meets standards',
                'Stakeholders informed',
                'Implementation plan provided'
            ]
        };
    }
    generateInstructions(type, decision) {
        const instructions = [];
        instructions.push({
            step: 1,
            action: 'Review Context',
            details: 'Review the HITL decision context, AI recommendations, and background information',
            tools: ['dashboard', 'documents'],
            checkpoints: ['Context understood', 'AI recommendations reviewed']
        });
        instructions.push({
            step: 2,
            action: 'Analyze Information',
            details: 'Analyze the provided information, validate AI assumptions, and identify gaps',
            tools: ['analysis-tools', 'data-sources'],
            checkpoints: ['Analysis complete', 'Gaps identified', 'Assumptions validated']
        });
        instructions.push({
            step: 3,
            action: 'Make Decision',
            details: 'Make the final decision based on analysis and human judgment',
            checkpoints: ['Decision made', 'Rationale documented', 'Implementation plan created']
        });
        return instructions;
    }
    gatherResources(decision) {
        const resources = [];
        resources.push({
            id: 'decision-context',
            name: 'Decision Context',
            type: 'data',
            location: 'dashboard',
            description: 'Complete context of the HITL decision including AI recommendations'
        });
        if (decision.metadata.clientId) {
            resources.push({
                id: 'client-profile',
                name: 'Client Profile',
                type: 'document',
                location: 'crm-system',
                description: 'Client information and history'
            });
        }
        return resources;
    }
    generateMilestones(type, decision) {
        const now = new Date();
        const milestones = [];
        milestones.push({
            id: 'initial-review',
            name: 'Initial Review Complete',
            description: 'Context and AI recommendations reviewed',
            targetDate: new Date(now.getTime() + 30 * 60 * 1000),
            completed: false,
            deliverables: ['Review notes', 'Initial assessment']
        });
        if (type === 'analysis') {
            milestones.push({
                id: 'analysis-complete',
                name: 'Analysis Complete',
                description: 'Detailed analysis finished',
                targetDate: new Date(now.getTime() + 90 * 60 * 1000),
                completed: false,
                deliverables: ['Analysis report', 'Findings summary']
            });
        }
        milestones.push({
            id: 'decision-made',
            name: 'Decision Made',
            description: 'Final decision reached and documented',
            targetDate: new Date(now.getTime() + 120 * 60 * 1000),
            completed: false,
            deliverables: ['Decision document', 'Implementation plan']
        });
        return milestones;
    }
    generateQualityChecks(type) {
        const checks = [];
        checks.push({
            id: 'completeness',
            name: 'Completeness Check',
            criteria: 'All required outputs provided and complete',
            type: 'manual'
        });
        checks.push({
            id: 'accuracy',
            name: 'Accuracy Check',
            criteria: 'Information is accurate and verified',
            type: 'manual'
        });
        if (type === 'analysis' || type === 'research') {
            checks.push({
                id: 'methodology',
                name: 'Methodology Check',
                criteria: 'Analysis methodology is sound and appropriate',
                type: 'manual'
            });
        }
        return checks;
    }
    shouldRequireReview(type, decision) {
        return (decision.context.riskLevel === 'critical' ||
            (decision.context.financialImpact && decision.context.financialImpact > 50000) ||
            decision.metadata.priority === 'critical' ||
            type === 'decision');
    }
    determineUrgencyReason(decision) {
        if (decision.metadata.priority === 'critical') {
            return 'Critical business decision requiring immediate attention';
        }
        if (decision.context.riskLevel === 'high' || decision.context.riskLevel === 'critical') {
            return `High risk level (${decision.context.riskLevel}) requires careful review`;
        }
        if (decision.context.financialImpact && decision.context.financialImpact > 100000) {
            return `High financial impact ($${decision.context.financialImpact}) requires validation`;
        }
        return 'Standard review process';
    }
    buildEscalationPath(decision) {
        const basePath = ['specialist', 'manager', 'senior-manager'];
        if (decision.context.riskLevel === 'critical') {
            basePath.push('director', 'executive');
        }
        if (decision.context.financialImpact && decision.context.financialImpact > 100000) {
            basePath.push('executive', 'board');
        }
        return Array.from(new Set(basePath));
    }
    calculateWorkloadImpact(task) {
        const weeklyHours = 40 * 60;
        return task.estimatedDuration / weeklyHours;
    }
    updateOperatorPerformance(operator, task) {
        operator.performance.tasksCompleted += 1;
        const estimatedVsActual = task.timeSpent / task.estimatedDuration;
        operator.performance.averageTime =
            (operator.performance.averageTime + estimatedVsActual) / 2;
    }
    checkMilestoneCompletion(task) {
        task.milestones.forEach(milestone => {
            if (!milestone.completed && task.progress >= this.getMilestoneThreshold(milestone)) {
                milestone.completed = true;
                milestone.completedAt = new Date();
                this.emit('milestone:completed', { task, milestone });
            }
        });
    }
    getMilestoneThreshold(milestone) {
        const thresholds = {
            'initial-review': 25,
            'analysis-complete': 75,
            'decision-made': 100
        };
        return thresholds[milestone.id] || 50;
    }
    async runQualityChecks(task) {
        for (const check of task.qualityChecks) {
            if (check.type === 'automatic') {
                check.passed = await this.runAutomaticQualityCheck(task, check);
                check.checkedAt = new Date();
            }
        }
    }
    async runAutomaticQualityCheck(task, check) {
        switch (check.id) {
            case 'completeness':
                return task.outputs && Object.keys(task.outputs).length > 0;
            default:
                return true;
        }
    }
    increasePriority(priority) {
        const priorityOrder = ['low', 'medium', 'high', 'critical'];
        const currentIndex = priorityOrder.indexOf(priority);
        return priorityOrder[Math.min(currentIndex + 1, priorityOrder.length - 1)];
    }
    addStrategy(strategy) {
        this.strategies.set(strategy.id, strategy);
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getTasksByStatus(status) {
        return Array.from(this.tasks.values()).filter(task => task.status === status);
    }
    getTasksForOperator(operatorId) {
        return Array.from(this.tasks.values()).filter(task => task.assignedTo === operatorId);
    }
    getOperator(id) {
        return this.operators.get(id);
    }
    getOperators() {
        return Array.from(this.operators.values());
    }
    async cancelTask(taskId, reason) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new Error(`Task ${taskId} not found`);
        task.status = 'cancelled';
        task.feedback = `Cancelled: ${reason}`;
        if (task.assignedTo) {
            const operator = this.operators.get(task.assignedTo);
            if (operator) {
                operator.workload -= this.calculateWorkloadImpact(task);
                operator.workload = Math.max(0, operator.workload);
            }
        }
        await this.swarmMemory.store(`delegation:task:${task.id}`, task);
        this.emit('task:cancelled', { task, reason });
    }
    getDelegationAnalytics() {
        const tasks = Array.from(this.tasks.values());
        const operators = Array.from(this.operators.values());
        return {
            totalTasks: tasks.length,
            tasksByStatus: {
                pending: tasks.filter(t => t.status === 'pending').length,
                assigned: tasks.filter(t => t.status === 'assigned').length,
                in_progress: tasks.filter(t => t.status === 'in_progress').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                failed: tasks.filter(t => t.status === 'failed').length,
                cancelled: tasks.filter(t => t.status === 'cancelled').length
            },
            operatorUtilization: operators.map(op => ({
                id: op.id,
                name: op.name,
                workload: op.workload,
                activeTasks: tasks.filter(t => t.assignedTo === op.id && t.status === 'in_progress').length
            })),
            averageCompletionTime: this.calculateAverageCompletionTime(tasks),
            qualityMetrics: this.calculateQualityMetrics(tasks)
        };
    }
    calculateAverageCompletionTime(tasks) {
        const completedTasks = tasks.filter(t => t.status === 'completed' && t.timeSpent > 0);
        if (completedTasks.length === 0)
            return 0;
        const totalTime = completedTasks.reduce((sum, task) => sum + task.timeSpent, 0);
        return totalTime / completedTasks.length;
    }
    calculateQualityMetrics(tasks) {
        const completedTasks = tasks.filter(t => t.status === 'completed');
        if (completedTasks.length === 0)
            return { averageQuality: 0, passRate: 0 };
        const tasksWithQualityChecks = completedTasks.filter(t => t.qualityChecks.length > 0);
        const passedTasks = tasksWithQualityChecks.filter(t => t.qualityChecks.every(check => check.passed !== false));
        return {
            averageQuality: tasksWithQualityChecks.length > 0 ?
                (passedTasks.length / tasksWithQualityChecks.length) * 5 : 0,
            passRate: tasksWithQualityChecks.length > 0 ?
                passedTasks.length / tasksWithQualityChecks.length : 0
        };
    }
    cleanup() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer);
        }
        this.activeTimers.clear();
    }
}
exports.TaskDelegationManager = TaskDelegationManager;
//# sourceMappingURL=TaskDelegationManager.js.map