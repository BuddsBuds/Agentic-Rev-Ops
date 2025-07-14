// Asana Project Management Integration for Agentic RevOps
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

export interface AsanaConfig {
  accessToken: string;
  baseUrl?: string;
  workspace?: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  color?: string;
  team?: string;
  owner?: string;
  current_status?: string;
  due_date?: string;
  custom_fields?: AsanaCustomField[];
  members?: AsanaUser[];
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  projects: string[];
  assignee?: string;
  due_on?: string;
  due_at?: string;
  completed: boolean;
  dependencies?: string[];
  parent?: string;
  subtasks?: string[];
  tags?: string[];
  custom_fields?: AsanaCustomField[];
  attachments?: AsanaAttachment[];
}

export interface AsanaUser {
  gid: string;
  name: string;
  email: string;
  resource_type: 'user';
  workspaces?: AsanaWorkspace[];
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
  resource_type: 'workspace';
  is_organization: boolean;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  type: 'text' | 'number' | 'enum' | 'multi_enum' | 'date' | 'people';
  description?: string;
  enum_options?: AsanaEnumOption[];
  enum_value?: AsanaEnumOption;
  multi_enum_values?: AsanaEnumOption[];
  text_value?: string;
  number_value?: number;
  date_value?: string;
  people_value?: AsanaUser[];
}

export interface AsanaEnumOption {
  gid: string;
  name: string;
  color?: string;
  enabled?: boolean;
}

export interface AsanaAttachment {
  gid: string;
  name: string;
  resource_type: 'attachment';
  created_at: string;
  download_url?: string;
  host: 'asana' | 'external' | 'dropbox' | 'google_drive' | 'box' | 'onedrive';
  parent: AsanaTask;
  permanent_url?: string;
  size?: number;
  url_host?: string;
  view_url?: string;
}

export interface AsanaProjectTemplate {
  gid: string;
  name: string;
  description?: string;
  color?: string;
  public?: boolean;
  team?: string;
  requested_dates?: AsanaDateVariable[];
  requested_roles?: AsanaRequestedRole[];
}

export interface AsanaDateVariable {
  gid: string;
  name: string;
  description?: string;
}

export interface AsanaRequestedRole {
  role: string;
  user?: AsanaUser;
}

export interface AsanaWebhook {
  gid: string;
  resource: AsanaResource;
  target: string;
  active: boolean;
  filters?: AsanaWebhookFilter[];
}

export interface AsanaResource {
  gid: string;
  resource_type: 'task' | 'project' | 'team' | 'workspace';
  name?: string;
}

export interface AsanaWebhookFilter {
  resource_type: string;
  resource_subtype?: string;
  action?: 'added' | 'removed' | 'changed' | 'deleted';
  fields?: string[];
}

export interface AsanaPortfolio {
  gid: string;
  name: string;
  color?: string;
  members?: AsanaUser[];
  projects?: AsanaProject[];
  created_at: string;
  created_by: AsanaUser;
  custom_field_settings?: AsanaCustomFieldSetting[];
  owner?: AsanaUser;
  public?: boolean;
  workspace: AsanaWorkspace;
}

export interface AsanaCustomFieldSetting {
  gid: string;
  custom_field: AsanaCustomField;
  is_important?: boolean;
  parent: AsanaProject | AsanaPortfolio;
  project?: AsanaProject;
}

export interface AsanaRevOpsData {
  projects: AsanaProject[];
  tasks: AsanaTask[];
  portfolios: AsanaPortfolio[];
  team_members: AsanaUser[];
  custom_fields: AsanaCustomField[];
  webhooks: AsanaWebhook[];
}

export class AsanaIntegration extends EventEmitter {
  private client: AxiosInstance;
  private config: AsanaConfig;
  private rateLimitRemaining: number = 1500;
  private rateLimitResetTime: Date = new Date();

  constructor(config: AsanaConfig) {
    super();
    this.config = {
      baseUrl: 'https://app.asana.com/api/1.0',
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Asana-Enable': 'string_ids,new_user_task_lists'
      },
      timeout: 30000
    });

    this.setupResponseInterceptors();
  }

  private setupResponseInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => {
        // Track rate limits
        if (response.headers['x-ratelimit-remaining']) {
          this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
        }
        if (response.headers['x-ratelimit-reset']) {
          this.rateLimitResetTime = new Date(parseInt(response.headers['x-ratelimit-reset']) * 1000);
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          this.emit('rate-limit-exceeded', { retryAfter });
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication and connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.status === 200;
    } catch (error) {
      this.emit('connection-error', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<AsanaUser> {
    const response = await this.client.get('/users/me');
    return response.data.data;
  }

  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    const response = await this.client.get('/workspaces');
    return response.data.data;
  }

  // Project Management Operations
  async createProject(projectData: Partial<AsanaProject>): Promise<AsanaProject> {
    const response = await this.client.post('/projects', {
      data: {
        ...projectData,
        workspace: this.config.workspace
      }
    });
    
    const project = response.data.data;
    this.emit('project-created', project);
    return project;
  }

  async createProjectFromTemplate(templateGid: string, projectData: {
    name: string;
    team?: string;
    public?: boolean;
    requested_dates?: { [key: string]: string };
    requested_roles?: { [key: string]: string };
  }): Promise<AsanaProject> {
    const response = await this.client.post(`/project_templates/${templateGid}/instantiateProject`, {
      data: {
        ...projectData,
        workspace: this.config.workspace
      }
    });
    
    const project = response.data.data;
    this.emit('project-created-from-template', { template: templateGid, project });
    return project;
  }

  async getProject(projectGid: string): Promise<AsanaProject> {
    const response = await this.client.get(`/projects/${projectGid}`, {
      params: {
        opt_fields: 'name,notes,color,team,owner,current_status,due_date,custom_fields,members'
      }
    });
    return response.data.data;
  }

  async updateProject(projectGid: string, updates: Partial<AsanaProject>): Promise<AsanaProject> {
    const response = await this.client.put(`/projects/${projectGid}`, {
      data: updates
    });
    
    const project = response.data.data;
    this.emit('project-updated', project);
    return project;
  }

  async deleteProject(projectGid: string): Promise<void> {
    await this.client.delete(`/projects/${projectGid}`);
    this.emit('project-deleted', { projectGid });
  }

  async getProjectTasks(projectGid: string): Promise<AsanaTask[]> {
    const response = await this.client.get(`/projects/${projectGid}/tasks`, {
      params: {
        opt_fields: 'name,notes,assignee,due_on,due_at,completed,dependencies,parent,subtasks,tags,custom_fields'
      }
    });
    return response.data.data;
  }

  // Task Operations
  async createTask(taskData: Partial<AsanaTask>): Promise<AsanaTask> {
    const response = await this.client.post('/tasks', {
      data: taskData
    });
    
    const task = response.data.data;
    this.emit('task-created', task);
    return task;
  }

  async getTask(taskGid: string): Promise<AsanaTask> {
    const response = await this.client.get(`/tasks/${taskGid}`, {
      params: {
        opt_fields: 'name,notes,projects,assignee,due_on,due_at,completed,dependencies,parent,subtasks,tags,custom_fields,attachments'
      }
    });
    return response.data.data;
  }

  async updateTask(taskGid: string, updates: Partial<AsanaTask>): Promise<AsanaTask> {
    const response = await this.client.put(`/tasks/${taskGid}`, {
      data: updates
    });
    
    const task = response.data.data;
    this.emit('task-updated', task);
    return task;
  }

  async completeTask(taskGid: string): Promise<AsanaTask> {
    return this.updateTask(taskGid, { completed: true });
  }

  async deleteTask(taskGid: string): Promise<void> {
    await this.client.delete(`/tasks/${taskGid}`);
    this.emit('task-deleted', { taskGid });
  }

  async addTaskDependency(taskGid: string, dependencyGid: string): Promise<void> {
    await this.client.post(`/tasks/${taskGid}/addDependencies`, {
      data: {
        dependencies: [dependencyGid]
      }
    });
    this.emit('task-dependency-added', { taskGid, dependencyGid });
  }

  async addTaskComment(taskGid: string, text: string): Promise<any> {
    const response = await this.client.post(`/tasks/${taskGid}/stories`, {
      data: {
        text,
        type: 'comment'
      }
    });
    
    const comment = response.data.data;
    this.emit('task-comment-added', { taskGid, comment });
    return comment;
  }

  // Portfolio Management
  async createPortfolio(portfolioData: {
    name: string;
    color?: string;
    members?: string[];
    public?: boolean;
  }): Promise<AsanaPortfolio> {
    const response = await this.client.post('/portfolios', {
      data: {
        ...portfolioData,
        workspace: this.config.workspace
      }
    });
    
    const portfolio = response.data.data;
    this.emit('portfolio-created', portfolio);
    return portfolio;
  }

  async getPortfolio(portfolioGid: string): Promise<AsanaPortfolio> {
    const response = await this.client.get(`/portfolios/${portfolioGid}`, {
      params: {
        opt_fields: 'name,color,members,projects,created_at,created_by,custom_field_settings,owner,public,workspace'
      }
    });
    return response.data.data;
  }

  async addProjectToPortfolio(portfolioGid: string, projectGid: string): Promise<void> {
    await this.client.post(`/portfolios/${portfolioGid}/addItem`, {
      data: {
        item: projectGid
      }
    });
    this.emit('project-added-to-portfolio', { portfolioGid, projectGid });
  }

  // Custom Fields
  async createCustomField(customFieldData: {
    name: string;
    type: 'text' | 'number' | 'enum' | 'multi_enum' | 'date' | 'people';
    description?: string;
    enum_options?: { name: string; color?: string }[];
  }): Promise<AsanaCustomField> {
    const response = await this.client.post('/custom_fields', {
      data: {
        ...customFieldData,
        workspace: this.config.workspace
      }
    });
    
    const customField = response.data.data;
    this.emit('custom-field-created', customField);
    return customField;
  }

  async getCustomFields(): Promise<AsanaCustomField[]> {
    const response = await this.client.get('/custom_fields', {
      params: {
        workspace: this.config.workspace
      }
    });
    return response.data.data;
  }

  async setCustomFieldValue(taskGid: string, customFieldGid: string, value: any): Promise<void> {
    await this.client.put(`/tasks/${taskGid}`, {
      data: {
        custom_fields: {
          [customFieldGid]: value
        }
      }
    });
    this.emit('custom-field-updated', { taskGid, customFieldGid, value });
  }

  // Webhooks
  async createWebhook(webhookData: {
    resource: string;
    target: string;
    filters?: AsanaWebhookFilter[];
  }): Promise<AsanaWebhook> {
    const response = await this.client.post('/webhooks', {
      data: webhookData
    });
    
    const webhook = response.data.data;
    this.emit('webhook-created', webhook);
    return webhook;
  }

  async getWebhooks(): Promise<AsanaWebhook[]> {
    const response = await this.client.get('/webhooks', {
      params: {
        workspace: this.config.workspace
      }
    });
    return response.data.data;
  }

  async deleteWebhook(webhookGid: string): Promise<void> {
    await this.client.delete(`/webhooks/${webhookGid}`);
    this.emit('webhook-deleted', { webhookGid });
  }

  // RevOps Specific Operations
  async setupRevOpsProject(clientName: string, templateGid?: string): Promise<AsanaRevOpsData> {
    // Create client portfolio
    const portfolio = await this.createPortfolio({
      name: `${clientName} - RevOps Portfolio`,
      color: 'blue',
      public: false
    });

    let project: AsanaProject;
    
    if (templateGid) {
      // Create from template
      project = await this.createProjectFromTemplate(templateGid, {
        name: `${clientName} - Revenue Operations`,
        public: false
      });
    } else {
      // Create standard project
      project = await this.createProject({
        name: `${clientName} - Revenue Operations`,
        notes: `Revenue Operations project for ${clientName}`,
        color: 'green',
        public: false
      });
    }

    // Add project to portfolio
    await this.addProjectToPortfolio(portfolio.gid, project.gid);

    // Create standard RevOps tasks
    const tasks = await this.createRevOpsTasks(project.gid, clientName);

    // Setup custom fields for RevOps tracking
    const customFields = await this.setupRevOpsCustomFields();

    // Setup webhooks for real-time updates
    const webhooks = await this.setupRevOpsWebhooks(project.gid);

    const revOpsData: AsanaRevOpsData = {
      projects: [project],
      tasks,
      portfolios: [portfolio],
      team_members: await this.getProjectMembers(project.gid),
      custom_fields: customFields,
      webhooks
    };

    this.emit('revops-project-setup', { clientName, data: revOpsData });
    return revOpsData;
  }

  private async createRevOpsTasks(projectGid: string, clientName: string): Promise<AsanaTask[]> {
    const taskTemplates = [
      { name: 'Client Discovery & Analysis', section: 'Discovery' },
      { name: 'Current State Assessment', section: 'Discovery' },
      { name: 'Revenue Process Mapping', section: 'Analysis' },
      { name: 'Technology Stack Audit', section: 'Analysis' },
      { name: 'Strategy Development', section: 'Strategy' },
      { name: 'Implementation Roadmap', section: 'Strategy' },
      { name: 'Process Implementation', section: 'Implementation' },
      { name: 'Technology Integration', section: 'Implementation' },
      { name: 'Training & Enablement', section: 'Implementation' },
      { name: 'Performance Monitoring', section: 'Optimization' },
      { name: 'Continuous Improvement', section: 'Optimization' }
    ];

    const tasks: AsanaTask[] = [];
    for (const template of taskTemplates) {
      const task = await this.createTask({
        name: `${template.name} - ${clientName}`,
        projects: [projectGid],
        notes: `${template.name} for ${clientName} revenue operations project`
      });
      tasks.push(task);
    }

    return tasks;
  }

  private async setupRevOpsCustomFields(): Promise<AsanaCustomField[]> {
    const customFieldTemplates = [
      {
        name: 'Client Priority',
        type: 'enum' as const,
        enum_options: [
          { name: 'Critical', color: 'red' },
          { name: 'High', color: 'orange' },
          { name: 'Medium', color: 'yellow' },
          { name: 'Low', color: 'green' }
        ]
      },
      {
        name: 'Revenue Impact',
        type: 'enum' as const,
        enum_options: [
          { name: 'High Impact', color: 'red' },
          { name: 'Medium Impact', color: 'yellow' },
          { name: 'Low Impact', color: 'green' }
        ]
      },
      {
        name: 'Implementation Phase',
        type: 'enum' as const,
        enum_options: [
          { name: 'Discovery', color: 'blue' },
          { name: 'Analysis', color: 'purple' },
          { name: 'Strategy', color: 'orange' },
          { name: 'Implementation', color: 'green' },
          { name: 'Optimization', color: 'teal' }
        ]
      },
      {
        name: 'Budget',
        type: 'number' as const,
        description: 'Budget allocation for this task'
      },
      {
        name: 'ROI Estimate',
        type: 'text' as const,
        description: 'Estimated return on investment'
      }
    ];

    const customFields: AsanaCustomField[] = [];
    for (const template of customFieldTemplates) {
      try {
        const customField = await this.createCustomField(template);
        customFields.push(customField);
      } catch (error) {
        // Custom field might already exist
        console.warn(`Custom field ${template.name} may already exist:`, error);
      }
    }

    return customFields;
  }

  private async setupRevOpsWebhooks(projectGid: string): Promise<AsanaWebhook[]> {
    const webhookConfigs = [
      {
        resource: projectGid,
        target: `${process.env.WEBHOOK_BASE_URL}/asana/project-updates`,
        filters: [
          { resource_type: 'task', action: 'changed' as const },
          { resource_type: 'task', action: 'added' as const },
          { resource_type: 'task', action: 'removed' as const }
        ]
      },
      {
        resource: projectGid,
        target: `${process.env.WEBHOOK_BASE_URL}/asana/status-updates`,
        filters: [
          { resource_type: 'project', action: 'changed' as const, fields: ['current_status'] }
        ]
      }
    ];

    const webhooks: AsanaWebhook[] = [];
    for (const config of webhookConfigs) {
      if (config.target.includes('undefined')) {
        console.warn('Webhook base URL not configured, skipping webhook setup');
        continue;
      }
      
      try {
        const webhook = await this.createWebhook(config);
        webhooks.push(webhook);
      } catch (error) {
        console.warn('Failed to create webhook:', error);
      }
    }

    return webhooks;
  }

  private async getProjectMembers(projectGid: string): Promise<AsanaUser[]> {
    const response = await this.client.get(`/projects/${projectGid}/project_memberships`, {
      params: {
        opt_fields: 'user.name,user.email'
      }
    });
    return response.data.data.map((membership: any) => membership.user);
  }

  // Utility Methods
  async searchTasks(query: string, projectGid?: string): Promise<AsanaTask[]> {
    const params: any = {
      resource_type: 'task',
      query,
      opt_fields: 'name,notes,projects,assignee,due_on,completed'
    };

    if (projectGid) {
      params.projects = projectGid;
    }

    const response = await this.client.get('/search', { params });
    return response.data.data;
  }

  async exportProjectData(projectGid: string): Promise<any> {
    const project = await this.getProject(projectGid);
    const tasks = await this.getProjectTasks(projectGid);
    const members = await this.getProjectMembers(projectGid);

    return {
      project,
      tasks,
      members,
      exportDate: new Date().toISOString(),
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.completed).length
    };
  }

  getRateLimitStatus(): { remaining: number; resetTime: Date } {
    return {
      remaining: this.rateLimitRemaining,
      resetTime: this.rateLimitResetTime
    };
  }

  async waitForRateLimit(): Promise<void> {
    if (this.rateLimitRemaining < 10) {
      const waitTime = this.rateLimitResetTime.getTime() - Date.now();
      if (waitTime > 0) {
        this.emit('rate-limit-wait', { waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

export default AsanaIntegration;