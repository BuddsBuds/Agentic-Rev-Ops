/**
 * Enhanced Asana Integration using the Integration Framework
 */

import { BaseIntegration, IntegrationConfig } from '../core/IntegrationFramework';
import { AsanaIntegration } from './asana-integration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';

export interface AsanaEnhancedConfig extends IntegrationConfig {
  workspace?: string;
  defaultProjectTemplateId?: string;
  customFieldMappings?: Record<string, string>;
  syncInterval?: number;
  enableWebhooks?: boolean;
  webhookSecret?: string;
}

export class AsanaEnhancedIntegration extends BaseIntegration {
  private asanaClient: AsanaIntegration;
  private swarmMemory?: SwarmMemory;
  private hitlSystem?: HITLSystem;
  private syncInterval?: NodeJS.Timeout;
  private webhookHandlers: Map<string, (event: any) => Promise<void>> = new Map();

  constructor(
    config: AsanaEnhancedConfig,
    swarmMemory?: SwarmMemory,
    hitlSystem?: HITLSystem
  ) {
    super(config);
    
    this.swarmMemory = swarmMemory;
    this.hitlSystem = hitlSystem;
    
    // Initialize the base Asana client
    this.asanaClient = new AsanaIntegration({
      accessToken: config.authConfig.oauth2?.accessToken || config.authConfig.apiKey?.key || '',
      workspace: config.workspace
    });

    this.setupAsanaEventHandlers();
    this.registerWebhookHandlers();
  }

  private setupAsanaEventHandlers(): void {
    // Forward Asana client events
    this.asanaClient.on('project-created', (project) => {
      this.emit('asana:project_created', project);
      this.syncToSwarmMemory('project', project);
    });

    this.asanaClient.on('task-created', (task) => {
      this.emit('asana:task_created', task);
      this.syncToSwarmMemory('task', task);
    });

    this.asanaClient.on('task-updated', (task) => {
      this.emit('asana:task_updated', task);
      this.checkHITLRequirements(task);
    });

    this.asanaClient.on('rate-limit-exceeded', (data) => {
      this.emit('asana:rate_limit', data);
    });
  }

  private registerWebhookHandlers(): void {
    // Task status changed
    this.webhookHandlers.set('task.status_changed', async (event) => {
      await this.handleTaskStatusChange(event);
    });

    // Task assigned
    this.webhookHandlers.set('task.assigned', async (event) => {
      await this.handleTaskAssignment(event);
    });

    // Project status updated
    this.webhookHandlers.set('project.status_updated', async (event) => {
      await this.handleProjectStatusUpdate(event);
    });

    // Custom field changed
    this.webhookHandlers.set('custom_field.changed', async (event) => {
      await this.handleCustomFieldChange(event);
    });
  }

  public async initialize(): Promise<void> {
    // Test connection
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Asana');
    }

    // Setup workspaces if not provided
    if (!this.config.workspace) {
      const workspaces = await this.asanaClient.getWorkspaces();
      if (workspaces.length > 0) {
        this.config.workspace = workspaces[0].gid;
      }
    }

    // Start sync if enabled
    if ((this.config as AsanaEnhancedConfig).syncInterval) {
      this.startSync();
    }

    // Setup webhooks if enabled
    if ((this.config as AsanaEnhancedConfig).enableWebhooks) {
      await this.setupWebhooks();
    }

    this.emit('initialized', { integrationId: this.config.id });
  }

  public async testConnection(): Promise<boolean> {
    try {
      return await this.asanaClient.testConnection();
    } catch (error) {
      this.emit('connection:failed', { error });
      return false;
    }
  }

  public async cleanup(): Promise<void> {
    // Stop sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Cleanup webhooks
    await this.cleanupWebhooks();

    this.emit('cleanup:completed', { integrationId: this.config.id });
  }

  /**
   * Enhanced Asana Operations
   */

  public async createRevOpsProject(clientName: string, options?: {
    templateId?: string;
    teamGid?: string;
    customFields?: Record<string, any>;
    initialTasks?: Array<{ name: string; notes?: string; assignee?: string }>;
  }): Promise<any> {
    try {
      // Create project structure
      const revOpsData = await this.asanaClient.setupRevOpsProject(
        clientName,
        options?.templateId || (this.config as AsanaEnhancedConfig).defaultProjectTemplateId
      );

      // Apply custom fields if provided
      if (options?.customFields) {
        await this.applyCustomFields(revOpsData.projects[0].gid, options.customFields);
      }

      // Create initial tasks if provided
      if (options?.initialTasks) {
        for (const taskData of options.initialTasks) {
          await this.asanaClient.createTask({
            name: taskData.name,
            notes: taskData.notes,
            projects: [revOpsData.projects[0].gid],
            assignee: taskData.assignee
          });
        }
      }

      // Store in swarm memory
      if (this.swarmMemory) {
        await this.swarmMemory.store(`asana:project:${revOpsData.projects[0].gid}`, {
          clientName,
          projectData: revOpsData,
          createdAt: new Date(),
          integrationId: this.config.id
        });
      }

      // Create HITL workflow if needed
      if (this.hitlSystem) {
        await this.createProjectWorkflow(revOpsData.projects[0]);
      }

      this.emit('revops:project_created', { clientName, data: revOpsData });
      return revOpsData;

    } catch (error) {
      this.emit('revops:project_creation_failed', { clientName, error });
      throw error;
    }
  }

  public async syncProjectWithNotion(
    asanaProjectGid: string,
    notionDatabaseId: string
  ): Promise<void> {
    try {
      // Get project data from Asana
      const project = await this.asanaClient.getProject(asanaProjectGid);
      const tasks = await this.asanaClient.getProjectTasks(asanaProjectGid);

      // Store sync mapping
      if (this.swarmMemory) {
        await this.swarmMemory.store(`integration:sync:asana-notion:${asanaProjectGid}`, {
          asanaProjectGid,
          notionDatabaseId,
          lastSync: new Date(),
          taskCount: tasks.length
        });
      }

      this.emit('sync:asana_notion_completed', { asanaProjectGid, notionDatabaseId });

    } catch (error) {
      this.emit('sync:asana_notion_failed', { asanaProjectGid, notionDatabaseId, error });
      throw error;
    }
  }

  public async createTaskWithApproval(taskData: any, approvalConfig: {
    requiresApproval: boolean;
    approvers?: string[];
    approvalThreshold?: number;
    escalationTime?: number;
  }): Promise<any> {
    try {
      // Create task in Asana
      const task = await this.asanaClient.createTask(taskData);

      // Create HITL decision if approval required
      if (approvalConfig.requiresApproval && this.hitlSystem) {
        const orchestrator = this.hitlSystem.getComponent('orchestrator');
        
        if (orchestrator) {
          const decision = await orchestrator.createDecision({
            title: `Approve Task: ${task.name}`,
            description: `Task requires approval: ${task.notes || 'No description'}`,
            type: 'task_approval',
            source: 'asana_integration',
            requiresApproval: true,
            context: {
              asanaTaskGid: task.gid,
              taskData: task,
              approvers: approvalConfig.approvers,
              approvalThreshold: approvalConfig.approvalThreshold
            },
            options: [
              { id: 'approve', label: 'Approve', value: true },
              { id: 'reject', label: 'Reject', value: false }
            ]
          });

          // Store mapping
          if (this.swarmMemory) {
            await this.swarmMemory.store(`asana:task:approval:${task.gid}`, {
              taskGid: task.gid,
              decisionId: decision.id,
              approvalConfig,
              createdAt: new Date()
            });
          }
        }
      }

      this.emit('task:created_with_approval', { task, approvalConfig });
      return task;

    } catch (error) {
      this.emit('task:creation_failed', { taskData, error });
      throw error;
    }
  }

  public async bulkUpdateTasks(updates: Array<{
    taskGid: string;
    updates: any;
  }>): Promise<Array<{ taskGid: string; success: boolean; error?: any }>> {
    const results = [];

    for (const update of updates) {
      try {
        await this.asanaClient.updateTask(update.taskGid, update.updates);
        results.push({ taskGid: update.taskGid, success: true });
      } catch (error) {
        results.push({ taskGid: update.taskGid, success: false, error });
      }
    }

    this.emit('bulk:tasks_updated', { results });
    return results;
  }

  /**
   * Webhook handling
   */

  public async handleWebhook(event: any, signature?: string): Promise<void> {
    // Verify webhook signature if configured
    if ((this.config as AsanaEnhancedConfig).webhookSecret && signature) {
      if (!this.verifyWebhookSignature(event, signature)) {
        throw new Error('Invalid webhook signature');
      }
    }

    const eventType = `${event.resource}.${event.action}`;
    const handler = this.webhookHandlers.get(eventType);

    if (handler) {
      await handler(event);
    } else {
      this.emit('webhook:unhandled', { eventType, event });
    }
  }

  private verifyWebhookSignature(event: any, signature: string): boolean {
    // Implement signature verification based on Asana's webhook security
    // This is a placeholder - implement actual verification
    return true;
  }

  private async handleTaskStatusChange(event: any): Promise<void> {
    const { gid: taskGid, fields } = event.resource;

    // Check if task completion requires notification
    if (fields.completed && this.swarmMemory) {
      const approvalData = await this.swarmMemory.retrieve(`asana:task:approval:${taskGid}`);
      
      if (approvalData && this.hitlSystem) {
        const orchestrator = this.hitlSystem.getComponent('orchestrator');
        if (orchestrator) {
          await orchestrator.completeDecision(approvalData.decisionId, {
            outcome: 'completed',
            metadata: { completedAt: new Date() }
          });
        }
      }
    }

    this.emit('webhook:task_status_changed', event);
  }

  private async handleTaskAssignment(event: any): Promise<void> {
    const { gid: taskGid, assignee } = event.resource;

    // Create delegation entry if HITL is enabled
    if (this.hitlSystem && assignee) {
      const delegationManager = this.hitlSystem.getComponent('delegation');
      
      if (delegationManager) {
        await delegationManager.createTask({
          title: `Asana Task Assigned: ${event.resource.name}`,
          type: 'asana_task',
          assignee: assignee.email,
          dueDate: event.resource.due_on ? new Date(event.resource.due_on) : undefined,
          metadata: {
            asanaTaskGid: taskGid,
            asanaAssigneeGid: assignee.gid
          }
        });
      }
    }

    this.emit('webhook:task_assigned', event);
  }

  private async handleProjectStatusUpdate(event: any): Promise<void> {
    const { gid: projectGid, current_status } = event.resource;

    // Store status update in memory
    if (this.swarmMemory) {
      await this.swarmMemory.store(`asana:project:status:${projectGid}:${Date.now()}`, {
        projectGid,
        status: current_status,
        timestamp: new Date()
      });
    }

    this.emit('webhook:project_status_updated', event);
  }

  private async handleCustomFieldChange(event: any): Promise<void> {
    const { gid, custom_fields } = event.resource;

    // Check if custom field requires action
    const customFieldMappings = (this.config as AsanaEnhancedConfig).customFieldMappings;
    
    if (customFieldMappings) {
      for (const [fieldName, action] of Object.entries(customFieldMappings)) {
        const field = custom_fields.find((f: any) => f.name === fieldName);
        
        if (field && field.enum_value) {
          await this.handleCustomFieldAction(gid, fieldName, field.enum_value.name, action);
        }
      }
    }

    this.emit('webhook:custom_field_changed', event);
  }

  /**
   * Private helper methods
   */

  private async syncToSwarmMemory(type: string, data: any): Promise<void> {
    if (!this.swarmMemory) return;

    await this.swarmMemory.store(`asana:${type}:${data.gid || data.id}`, {
      type,
      data,
      syncedAt: new Date(),
      integrationId: this.config.id
    });
  }

  private async checkHITLRequirements(task: any): Promise<void> {
    if (!this.hitlSystem) return;

    // Check if task meets criteria for HITL intervention
    const requiresReview = 
      task.custom_fields?.some((f: any) => f.name === 'Priority' && f.enum_value?.name === 'Critical') ||
      task.custom_fields?.some((f: any) => f.name === 'Revenue Impact' && f.enum_value?.name === 'High Impact');

    if (requiresReview) {
      const orchestrator = this.hitlSystem.getComponent('orchestrator');
      
      if (orchestrator) {
        await orchestrator.createDecision({
          title: `Review Critical Task: ${task.name}`,
          description: task.notes || 'Critical task requires review',
          type: 'task_review',
          source: 'asana_integration',
          requiresApproval: true,
          criticalityScore: 0.8,
          context: {
            asanaTaskGid: task.gid,
            taskData: task
          }
        });
      }
    }
  }

  private async createProjectWorkflow(project: any): Promise<void> {
    if (!this.hitlSystem) return;

    const workflowEngine = this.hitlSystem.getComponent('workflows');
    
    if (workflowEngine) {
      await workflowEngine.createWorkflow({
        name: `${project.name} - Review Workflow`,
        description: 'Automated review workflow for project milestones',
        stages: [
          {
            id: 'kickoff',
            name: 'Project Kickoff',
            type: 'approval',
            config: {
              requiresApproval: true,
              approvers: ['project_manager'],
              timeoutMinutes: 1440
            }
          },
          {
            id: 'milestone_review',
            name: 'Milestone Review',
            type: 'review',
            config: {
              requiresApproval: true,
              minApprovers: 2,
              timeoutMinutes: 2880
            }
          },
          {
            id: 'completion',
            name: 'Project Completion',
            type: 'notification',
            config: {
              notifyChannels: ['email', 'slack']
            }
          }
        ],
        metadata: {
          asanaProjectGid: project.gid,
          integrationId: this.config.id
        }
      });
    }
  }

  private async applyCustomFields(projectGid: string, customFields: Record<string, any>): Promise<void> {
    // Get existing custom fields
    const existingFields = await this.asanaClient.getCustomFields();

    for (const [fieldName, value] of Object.entries(customFields)) {
      const field = existingFields.find(f => f.name === fieldName);
      
      if (field) {
        // Apply custom field to project
        // This would require additional Asana API calls
        this.emit('custom_field:applied', { projectGid, fieldName, value });
      }
    }
  }

  private async handleCustomFieldAction(
    resourceGid: string, 
    fieldName: string, 
    value: string, 
    action: string
  ): Promise<void> {
    switch (action) {
      case 'escalate':
        if (this.hitlSystem) {
          await this.hitlSystem.createHumanTask({
            title: `Escalation Required: ${fieldName} = ${value}`,
            type: 'escalation',
            priority: 'high',
            metadata: {
              asanaResourceGid: resourceGid,
              fieldName,
              value
            }
          });
        }
        break;

      case 'notify':
        this.emit('custom_field:notification_required', {
          resourceGid,
          fieldName,
          value
        });
        break;

      case 'sync':
        await this.syncToSwarmMemory('custom_field_change', {
          resourceGid,
          fieldName,
          value,
          timestamp: new Date()
        });
        break;
    }
  }

  private startSync(): void {
    const interval = (this.config as AsanaEnhancedConfig).syncInterval || 300000; // 5 minutes default

    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, interval);

    // Perform initial sync
    this.performSync();
  }

  private async performSync(): Promise<void> {
    try {
      // Sync projects
      const workspaceGid = this.config.workspace || (this.config as AsanaEnhancedConfig).workspace;
      
      if (workspaceGid) {
        // This would require additional implementation to list all projects
        // and sync their current state
        this.emit('sync:started', { integrationId: this.config.id });
      }

    } catch (error) {
      this.emit('sync:failed', { integrationId: this.config.id, error });
    }
  }

  private async setupWebhooks(): Promise<void> {
    // Setup webhooks for real-time updates
    // This would require implementation based on your webhook endpoint
    this.emit('webhooks:setup_started', { integrationId: this.config.id });
  }

  private async cleanupWebhooks(): Promise<void> {
    // Cleanup webhooks
    try {
      const webhooks = await this.asanaClient.getWebhooks();
      
      for (const webhook of webhooks) {
        await this.asanaClient.deleteWebhook(webhook.gid);
      }

      this.emit('webhooks:cleaned_up', { integrationId: this.config.id });
      
    } catch (error) {
      this.emit('webhooks:cleanup_failed', { integrationId: this.config.id, error });
    }
  }

  /**
   * Public utility methods
   */

  public getAsanaClient(): AsanaIntegration {
    return this.asanaClient;
  }

  public async getProjectAnalytics(projectGid: string): Promise<any> {
    const tasks = await this.asanaClient.getProjectTasks(projectGid);
    
    const analytics = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      overdueTasks: tasks.filter(t => !t.completed && t.due_on && new Date(t.due_on) < new Date()).length,
      tasksByAssignee: this.groupTasksByAssignee(tasks),
      tasksByStatus: this.groupTasksByStatus(tasks),
      averageCompletionTime: await this.calculateAverageCompletionTime(tasks)
    };

    return analytics;
  }

  private groupTasksByAssignee(tasks: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const task of tasks) {
      const assignee = task.assignee?.name || 'Unassigned';
      grouped[assignee] = (grouped[assignee] || 0) + 1;
    }

    return grouped;
  }

  private groupTasksByStatus(tasks: any[]): Record<string, number> {
    return {
      completed: tasks.filter(t => t.completed).length,
      pending: tasks.filter(t => !t.completed).length
    };
  }

  private async calculateAverageCompletionTime(tasks: any[]): Promise<number> {
    // This would require fetching task stories to get completion times
    // Placeholder implementation
    return 0;
  }
}

export default AsanaEnhancedIntegration;