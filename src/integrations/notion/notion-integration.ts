// Notion Workspace Integration for Agentic RevOps
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

export interface NotionConfig {
  apiKey: string;
  version?: string;
  baseUrl?: string;
}

export interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  created_by: NotionUser;
  last_edited_time: string;
  last_edited_by: NotionUser;
  archived: boolean;
  icon?: NotionIcon;
  cover?: NotionCover;
  properties: Record<string, NotionProperty>;
  parent: NotionParent;
  url: string;
  public_url?: string;
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  created_time: string;
  created_by: NotionUser;
  last_edited_time: string;
  last_edited_by: NotionUser;
  title: NotionRichText[];
  description: NotionRichText[];
  icon?: NotionIcon;
  cover?: NotionCover;
  properties: Record<string, NotionPropertyDefinition>;
  parent: NotionParent;
  url: string;
  archived: boolean;
  is_inline: boolean;
  public_url?: string;
}

export interface NotionUser {
  id: string;
  object: 'user';
  type: 'person' | 'bot';
  name?: string;
  avatar_url?: string;
  person?: {
    email: string;
  };
  bot?: {
    owner: any;
    workspace_name?: string;
  };
}

export interface NotionIcon {
  type: 'emoji' | 'external' | 'file';
  emoji?: string;
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface NotionCover {
  type: 'external' | 'file';
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface NotionParent {
  type: 'database_id' | 'page_id' | 'workspace';
  database_id?: string;
  page_id?: string;
  workspace?: boolean;
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string };
  };
  mention?: any;
  equation?: { expression: string };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string;
}

export interface NotionProperty {
  id: string;
  type: string;
  [key: string]: any;
}

export interface NotionPropertyDefinition {
  id: string;
  name: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 'people' | 'files' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'formula' | 'relation' | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by';
  [key: string]: any;
}

export interface NotionBlock {
  id: string;
  object: 'block';
  type: string;
  created_time: string;
  created_by: NotionUser;
  last_edited_time: string;
  last_edited_by: NotionUser;
  archived: boolean;
  has_children: boolean;
  parent: NotionParent;
  [key: string]: any;
}

export interface NotionRevOpsStructure {
  clientName: string;
  databases: {
    clients: NotionDatabase;
    projects: NotionDatabase;
    tasks: NotionDatabase;
    meetings: NotionDatabase;
    documents: NotionDatabase;
    metrics: NotionDatabase;
  };
  pages: {
    commandCenter: NotionPage;
    knowledgeBase: NotionPage;
    analytics: NotionPage;
    clientOverview: NotionPage;
  };
}

export interface NotionFilter {
  property: string;
  [key: string]: any;
}

export interface NotionSort {
  property: string;
  direction: 'ascending' | 'descending';
}

export class NotionIntegration extends EventEmitter {
  private client: AxiosInstance;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    super();
    this.config = {
      version: '2022-06-28',
      baseUrl: 'https://api.notion.com/v1',
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': this.config.version!
      },
      timeout: 30000
    });

    this.setupResponseInterceptors();
  }

  private setupResponseInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          this.emit('rate-limit-exceeded', { retryAfter });
        }
        return Promise.reject(error);
      }
    );
  }

  // Connection and Authentication
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.status === 200;
    } catch (error) {
      this.emit('connection-error', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<NotionUser> {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async listUsers(): Promise<NotionUser[]> {
    const response = await this.client.get('/users');
    return response.data.results;
  }

  // Database Operations
  async createDatabase(
    parentPageId: string,
    title: string,
    properties: Record<string, NotionPropertyDefinition>
  ): Promise<NotionDatabase> {
    const response = await this.client.post('/databases', {
      parent: { page_id: parentPageId },
      title: [{ type: 'text', text: { content: title } }],
      properties
    });

    const database = response.data;
    this.emit('database-created', database);
    return database;
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    const response = await this.client.get(`/databases/${databaseId}`);
    return response.data;
  }

  async updateDatabase(
    databaseId: string,
    updates: {
      title?: NotionRichText[];
      description?: NotionRichText[];
      properties?: Record<string, NotionPropertyDefinition>;
    }
  ): Promise<NotionDatabase> {
    const response = await this.client.patch(`/databases/${databaseId}`, updates);
    
    const database = response.data;
    this.emit('database-updated', database);
    return database;
  }

  async queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: NotionSort[],
    startCursor?: string,
    pageSize?: number
  ): Promise<{ results: NotionPage[]; next_cursor?: string; has_more: boolean }> {
    const requestBody: any = {};
    
    if (filter) requestBody.filter = filter;
    if (sorts) requestBody.sorts = sorts;
    if (startCursor) requestBody.start_cursor = startCursor;
    if (pageSize) requestBody.page_size = pageSize;

    const response = await this.client.post(`/databases/${databaseId}/query`, requestBody);
    return response.data;
  }

  // Page Operations
  async createPage(
    parent: NotionParent,
    properties: Record<string, any>,
    children?: NotionBlock[],
    icon?: NotionIcon,
    cover?: NotionCover
  ): Promise<NotionPage> {
    const requestBody: any = {
      parent,
      properties
    };

    if (children) requestBody.children = children;
    if (icon) requestBody.icon = icon;
    if (cover) requestBody.cover = cover;

    const response = await this.client.post('/pages', requestBody);
    
    const page = response.data;
    this.emit('page-created', page);
    return page;
  }

  async getPage(pageId: string): Promise<NotionPage> {
    const response = await this.client.get(`/pages/${pageId}`);
    return response.data;
  }

  async updatePage(
    pageId: string,
    updates: {
      properties?: Record<string, any>;
      icon?: NotionIcon;
      cover?: NotionCover;
      archived?: boolean;
    }
  ): Promise<NotionPage> {
    const response = await this.client.patch(`/pages/${pageId}`, updates);
    
    const page = response.data;
    this.emit('page-updated', page);
    return page;
  }

  async deletePage(pageId: string): Promise<NotionPage> {
    return this.updatePage(pageId, { archived: true });
  }

  // Block Operations
  async getBlockChildren(blockId: string, startCursor?: string, pageSize?: number): Promise<{
    results: NotionBlock[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const params: any = {};
    if (startCursor) params.start_cursor = startCursor;
    if (pageSize) params.page_size = pageSize;

    const response = await this.client.get(`/blocks/${blockId}/children`, { params });
    return response.data;
  }

  async appendBlockChildren(blockId: string, children: NotionBlock[]): Promise<{
    results: NotionBlock[];
  }> {
    const response = await this.client.patch(`/blocks/${blockId}/children`, {
      children
    });

    this.emit('blocks-appended', { blockId, children: response.data.results });
    return response.data;
  }

  async updateBlock(blockId: string, updates: any): Promise<NotionBlock> {
    const response = await this.client.patch(`/blocks/${blockId}`, updates);
    
    const block = response.data;
    this.emit('block-updated', block);
    return block;
  }

  async deleteBlock(blockId: string): Promise<NotionBlock> {
    return this.updateBlock(blockId, { archived: true });
  }

  // RevOps Specific Operations
  async setupRevOpsWorkspace(clientName: string): Promise<NotionRevOpsStructure> {
    // Create main command center page
    const commandCenter = await this.createPage(
      { type: 'workspace', workspace: true },
      {
        title: {
          title: [{ type: 'text', text: { content: `${clientName} - RevOps Command Center` } }]
        }
      },
      [],
      { type: 'emoji', emoji: '🎯' }
    );

    // Create databases
    const databases = await this.createRevOpsDatabases(commandCenter.id, clientName);

    // Create additional pages
    const knowledgeBase = await this.createPage(
      { type: 'page_id', page_id: commandCenter.id },
      {
        title: {
          title: [{ type: 'text', text: { content: 'Knowledge Base' } }]
        }
      },
      [],
      { type: 'emoji', emoji: '📚' }
    );

    const analytics = await this.createPage(
      { type: 'page_id', page_id: commandCenter.id },
      {
        title: {
          title: [{ type: 'text', text: { content: 'Analytics Dashboard' } }]
        }
      },
      [],
      { type: 'emoji', emoji: '📊' }
    );

    const clientOverview = await this.createPage(
      { type: 'page_id', page_id: commandCenter.id },
      {
        title: {
          title: [{ type: 'text', text: { content: `${clientName} Overview` } }]
        }
      },
      [],
      { type: 'emoji', emoji: '🏢' }
    );

    // Setup initial content
    await this.setupCommandCenterContent(commandCenter.id, databases);
    await this.setupKnowledgeBaseContent(knowledgeBase.id);
    await this.setupAnalyticsDashboard(analytics.id, databases);
    await this.setupClientOverview(clientOverview.id, clientName, databases);

    const structure: NotionRevOpsStructure = {
      clientName,
      databases,
      pages: {
        commandCenter,
        knowledgeBase,
        analytics,
        clientOverview
      }
    };

    this.emit('revops-workspace-created', structure);
    return structure;
  }

  private async createRevOpsDatabases(parentPageId: string, clientName: string): Promise<NotionRevOpsStructure['databases']> {
    // Clients Database
    const clients = await this.createDatabase(
      parentPageId,
      'Clients',
      {
        'Name': {
          id: 'title',
          name: 'Name',
          type: 'title'
        },
        'Industry': {
          id: 'industry',
          name: 'Industry',
          type: 'select',
          select: {
            options: [
              { name: 'Technology', color: 'blue' },
              { name: 'Healthcare', color: 'green' },
              { name: 'Finance', color: 'yellow' },
              { name: 'Manufacturing', color: 'red' },
              { name: 'Retail', color: 'purple' },
              { name: 'Other', color: 'gray' }
            ]
          }
        },
        'Status': {
          id: 'status',
          name: 'Status',
          type: 'select',
          select: {
            options: [
              { name: 'Active', color: 'green' },
              { name: 'Onboarding', color: 'yellow' },
              { name: 'Paused', color: 'orange' },
              { name: 'Completed', color: 'blue' },
              { name: 'Cancelled', color: 'red' }
            ]
          }
        },
        'Contract Value': {
          id: 'contract_value',
          name: 'Contract Value',
          type: 'number',
          number: { format: 'dollar' }
        },
        'Start Date': {
          id: 'start_date',
          name: 'Start Date',
          type: 'date'
        },
        'End Date': {
          id: 'end_date',
          name: 'End Date',
          type: 'date'
        },
        'Account Manager': {
          id: 'account_manager',
          name: 'Account Manager',
          type: 'people'
        },
        'Health Score': {
          id: 'health_score',
          name: 'Health Score',
          type: 'select',
          select: {
            options: [
              { name: 'Excellent', color: 'green' },
              { name: 'Good', color: 'blue' },
              { name: 'Fair', color: 'yellow' },
              { name: 'Poor', color: 'orange' },
              { name: 'Critical', color: 'red' }
            ]
          }
        },
        'Notes': {
          id: 'notes',
          name: 'Notes',
          type: 'rich_text'
        }
      }
    );

    // Projects Database
    const projects = await this.createDatabase(
      parentPageId,
      'Projects',
      {
        'Project Name': {
          id: 'title',
          name: 'Project Name',
          type: 'title'
        },
        'Client': {
          id: 'client',
          name: 'Client',
          type: 'relation',
          relation: { database_id: clients.id }
        },
        'Phase': {
          id: 'phase',
          name: 'Phase',
          type: 'select',
          select: {
            options: [
              { name: 'Discovery', color: 'blue' },
              { name: 'Analysis', color: 'purple' },
              { name: 'Strategy', color: 'orange' },
              { name: 'Implementation', color: 'green' },
              { name: 'Optimization', color: 'teal' },
              { name: 'Complete', color: 'gray' }
            ]
          }
        },
        'Priority': {
          id: 'priority',
          name: 'Priority',
          type: 'select',
          select: {
            options: [
              { name: 'Critical', color: 'red' },
              { name: 'High', color: 'orange' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'green' }
            ]
          }
        },
        'Progress': {
          id: 'progress',
          name: 'Progress',
          type: 'number',
          number: { format: 'percent' }
        },
        'Start Date': {
          id: 'start_date',
          name: 'Start Date',
          type: 'date'
        },
        'Due Date': {
          id: 'due_date',
          name: 'Due Date',
          type: 'date'
        },
        'Owner': {
          id: 'owner',
          name: 'Owner',
          type: 'people'
        },
        'Budget': {
          id: 'budget',
          name: 'Budget',
          type: 'number',
          number: { format: 'dollar' }
        },
        'ROI Target': {
          id: 'roi_target',
          name: 'ROI Target',
          type: 'rich_text'
        }
      }
    );

    // Tasks Database
    const tasks = await this.createDatabase(
      parentPageId,
      'Tasks',
      {
        'Task': {
          id: 'title',
          name: 'Task',
          type: 'title'
        },
        'Project': {
          id: 'project',
          name: 'Project',
          type: 'relation',
          relation: { database_id: projects.id }
        },
        'Status': {
          id: 'status',
          name: 'Status',
          type: 'select',
          select: {
            options: [
              { name: 'Not Started', color: 'gray' },
              { name: 'In Progress', color: 'blue' },
              { name: 'Review', color: 'yellow' },
              { name: 'Completed', color: 'green' },
              { name: 'Blocked', color: 'red' }
            ]
          }
        },
        'Assignee': {
          id: 'assignee',
          name: 'Assignee',
          type: 'people'
        },
        'Due Date': {
          id: 'due_date',
          name: 'Due Date',
          type: 'date'
        },
        'Effort (Hours)': {
          id: 'effort',
          name: 'Effort (Hours)',
          type: 'number'
        },
        'Tags': {
          id: 'tags',
          name: 'Tags',
          type: 'multi_select',
          multi_select: {
            options: [
              { name: 'Analysis', color: 'purple' },
              { name: 'Implementation', color: 'green' },
              { name: 'Research', color: 'blue' },
              { name: 'Documentation', color: 'orange' },
              { name: 'Training', color: 'yellow' },
              { name: 'Testing', color: 'red' }
            ]
          }
        },
        'Description': {
          id: 'description',
          name: 'Description',
          type: 'rich_text'
        }
      }
    );

    // Meetings Database
    const meetings = await this.createDatabase(
      parentPageId,
      'Meetings',
      {
        'Meeting Title': {
          id: 'title',
          name: 'Meeting Title',
          type: 'title'
        },
        'Client': {
          id: 'client',
          name: 'Client',
          type: 'relation',
          relation: { database_id: clients.id }
        },
        'Date': {
          id: 'date',
          name: 'Date',
          type: 'date'
        },
        'Type': {
          id: 'type',
          name: 'Type',
          type: 'select',
          select: {
            options: [
              { name: 'Kickoff', color: 'green' },
              { name: 'Status Update', color: 'blue' },
              { name: 'Review', color: 'purple' },
              { name: 'Strategy', color: 'orange' },
              { name: 'Training', color: 'yellow' },
              { name: 'QBR', color: 'red' }
            ]
          }
        },
        'Attendees': {
          id: 'attendees',
          name: 'Attendees',
          type: 'people'
        },
        'Recording': {
          id: 'recording',
          name: 'Recording',
          type: 'url'
        },
        'Action Items': {
          id: 'action_items',
          name: 'Action Items',
          type: 'rich_text'
        },
        'Notes': {
          id: 'notes',
          name: 'Notes',
          type: 'rich_text'
        }
      }
    );

    // Documents Database
    const documents = await this.createDatabase(
      parentPageId,
      'Documents',
      {
        'Document': {
          id: 'title',
          name: 'Document',
          type: 'title'
        },
        'Client': {
          id: 'client',
          name: 'Client',
          type: 'relation',
          relation: { database_id: clients.id }
        },
        'Type': {
          id: 'type',
          name: 'Type',
          type: 'select',
          select: {
            options: [
              { name: 'Strategy', color: 'orange' },
              { name: 'Process', color: 'blue' },
              { name: 'Report', color: 'green' },
              { name: 'Proposal', color: 'purple' },
              { name: 'Template', color: 'yellow' },
              { name: 'Analysis', color: 'red' }
            ]
          }
        },
        'Status': {
          id: 'status',
          name: 'Status',
          type: 'select',
          select: {
            options: [
              { name: 'Draft', color: 'yellow' },
              { name: 'Review', color: 'orange' },
              { name: 'Approved', color: 'green' },
              { name: 'Published', color: 'blue' },
              { name: 'Archived', color: 'gray' }
            ]
          }
        },
        'Author': {
          id: 'author',
          name: 'Author',
          type: 'people'
        },
        'Link': {
          id: 'link',
          name: 'Link',
          type: 'url'
        },
        'Created': {
          id: 'created',
          name: 'Created',
          type: 'created_time'
        },
        'Last Updated': {
          id: 'last_updated',
          name: 'Last Updated',
          type: 'last_edited_time'
        }
      }
    );

    // Metrics Database
    const metrics = await this.createDatabase(
      parentPageId,
      'Metrics',
      {
        'Metric': {
          id: 'title',
          name: 'Metric',
          type: 'title'
        },
        'Client': {
          id: 'client',
          name: 'Client',
          type: 'relation',
          relation: { database_id: clients.id }
        },
        'Category': {
          id: 'category',
          name: 'Category',
          type: 'select',
          select: {
            options: [
              { name: 'Revenue', color: 'green' },
              { name: 'Process', color: 'blue' },
              { name: 'Efficiency', color: 'purple' },
              { name: 'Quality', color: 'orange' },
              { name: 'Customer', color: 'red' },
              { name: 'Growth', color: 'yellow' }
            ]
          }
        },
        'Current Value': {
          id: 'current_value',
          name: 'Current Value',
          type: 'number'
        },
        'Target Value': {
          id: 'target_value',
          name: 'Target Value',
          type: 'number'
        },
        'Unit': {
          id: 'unit',
          name: 'Unit',
          type: 'select',
          select: {
            options: [
              { name: 'Dollar', color: 'green' },
              { name: 'Percentage', color: 'blue' },
              { name: 'Count', color: 'purple' },
              { name: 'Days', color: 'orange' },
              { name: 'Hours', color: 'yellow' },
              { name: 'Score', color: 'red' }
            ]
          }
        },
        'Trend': {
          id: 'trend',
          name: 'Trend',
          type: 'select',
          select: {
            options: [
              { name: 'Improving', color: 'green' },
              { name: 'Stable', color: 'blue' },
              { name: 'Declining', color: 'red' }
            ]
          }
        },
        'Last Updated': {
          id: 'last_updated',
          name: 'Last Updated',
          type: 'date'
        },
        'Notes': {
          id: 'notes',
          name: 'Notes',
          type: 'rich_text'
        }
      }
    );

    return {
      clients,
      projects,
      tasks,
      meetings,
      documents,
      metrics
    };
  }

  private async setupCommandCenterContent(pageId: string, databases: NotionRevOpsStructure['databases']): Promise<void> {
    const blocks: any[] = [
      {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: 'RevOps Command Center' } }]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            type: 'text', 
            text: { content: 'Welcome to your Revenue Operations Command Center. This workspace provides a unified view of all client engagements, projects, and performance metrics.' }
          }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Quick Access' } }]
        }
      },
      {
        type: 'child_database',
        child_database: {
          title: 'Active Projects'
        }
      },
      {
        type: 'child_database',
        child_database: {
          title: 'Recent Tasks'
        }
      },
      {
        type: 'child_database',
        child_database: {
          title: 'Key Metrics'
        }
      }
    ];

    await this.appendBlockChildren(pageId, blocks);
  }

  private async setupKnowledgeBaseContent(pageId: string): Promise<void> {
    const blocks: any[] = [
      {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: 'Knowledge Base' } }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Best Practices' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'Revenue Process Optimization' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'Technology Integration Strategies' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'Performance Monitoring' } }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Templates' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'Client Onboarding Checklist' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'QBR Presentation Template' } }]
        }
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: 'Process Documentation Template' } }]
        }
      }
    ];

    await this.appendBlockChildren(pageId, blocks);
  }

  private async setupAnalyticsDashboard(pageId: string, databases: NotionRevOpsStructure['databases']): Promise<void> {
    const blocks: any[] = [
      {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: 'Analytics Dashboard' } }]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            type: 'text', 
            text: { content: 'Real-time insights into client performance, project progress, and revenue metrics.' }
          }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Key Performance Indicators' } }]
        }
      },
      {
        type: 'child_database',
        child_database: {
          title: 'Revenue Metrics'
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Client Health Overview' } }]
        }
      },
      {
        type: 'child_database',
        child_database: {
          title: 'Client Health Scores'
        }
      }
    ];

    await this.appendBlockChildren(pageId, blocks);
  }

  private async setupClientOverview(pageId: string, clientName: string, databases: NotionRevOpsStructure['databases']): Promise<void> {
    const blocks: any[] = [
      {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: `${clientName} Overview` } }]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            type: 'text', 
            text: { content: `Comprehensive overview of ${clientName} engagement, including projects, metrics, and strategic initiatives.` }
          }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Active Projects' } }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Recent Meetings' } }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Key Documents' } }]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Performance Metrics' } }]
        }
      }
    ];

    await this.appendBlockChildren(pageId, blocks);
  }

  // Utility Methods
  async createClientRecord(
    databaseId: string,
    clientData: {
      name: string;
      industry?: string;
      status?: string;
      contractValue?: number;
      startDate?: string;
      endDate?: string;
      accountManager?: string;
      healthScore?: string;
      notes?: string;
    }
  ): Promise<NotionPage> {
    const properties: any = {
      'Name': {
        title: [{ type: 'text', text: { content: clientData.name } }]
      }
    };

    if (clientData.industry) {
      properties['Industry'] = { select: { name: clientData.industry } };
    }
    if (clientData.status) {
      properties['Status'] = { select: { name: clientData.status } };
    }
    if (clientData.contractValue) {
      properties['Contract Value'] = { number: clientData.contractValue };
    }
    if (clientData.startDate) {
      properties['Start Date'] = { date: { start: clientData.startDate } };
    }
    if (clientData.endDate) {
      properties['End Date'] = { date: { start: clientData.endDate } };
    }
    if (clientData.healthScore) {
      properties['Health Score'] = { select: { name: clientData.healthScore } };
    }
    if (clientData.notes) {
      properties['Notes'] = { rich_text: [{ type: 'text', text: { content: clientData.notes } }] };
    }

    return this.createPage(
      { type: 'database_id', database_id: databaseId },
      properties
    );
  }

  async syncWithAsana(asanaProjectData: any, projectsDatabaseId: string): Promise<NotionPage> {
    return this.createPage(
      { type: 'database_id', database_id: projectsDatabaseId },
      {
        'Project Name': {
          title: [{ type: 'text', text: { content: asanaProjectData.name } }]
        },
        'Progress': {
          number: asanaProjectData.progress || 0
        },
        'Start Date': {
          date: asanaProjectData.start_date ? { start: asanaProjectData.start_date } : undefined
        },
        'Due Date': {
          date: asanaProjectData.due_date ? { start: asanaProjectData.due_date } : undefined
        }
      }
    );
  }

  async syncWithGoogleDrive(driveFileData: any, documentsDatabaseId: string): Promise<NotionPage> {
    return this.createPage(
      { type: 'database_id', database_id: documentsDatabaseId },
      {
        'Document': {
          title: [{ type: 'text', text: { content: driveFileData.name } }]
        },
        'Link': {
          url: driveFileData.webViewLink
        },
        'Status': {
          select: { name: 'Published' }
        }
      }
    );
  }

  async generateClientReport(clientName: string, structure: NotionRevOpsStructure): Promise<any> {
    // Query client data from all databases
    const clientFilter = {
      property: 'Client',
      relation: {
        contains: clientName
      }
    };

    const [projects, tasks, meetings, documents, metrics] = await Promise.all([
      this.queryDatabase(structure.databases.projects.id, clientFilter),
      this.queryDatabase(structure.databases.tasks.id, { property: 'Project', relation: { contains: clientName } }),
      this.queryDatabase(structure.databases.meetings.id, clientFilter),
      this.queryDatabase(structure.databases.documents.id, clientFilter),
      this.queryDatabase(structure.databases.metrics.id, clientFilter)
    ]);

    return {
      clientName,
      summary: {
        totalProjects: projects.results.length,
        totalTasks: tasks.results.length,
        totalMeetings: meetings.results.length,
        totalDocuments: documents.results.length,
        totalMetrics: metrics.results.length
      },
      data: {
        projects: projects.results,
        tasks: tasks.results,
        meetings: meetings.results,
        documents: documents.results,
        metrics: metrics.results
      },
      generatedAt: new Date().toISOString()
    };
  }

  async exportWorkspace(structure: NotionRevOpsStructure): Promise<any> {
    const databases = {};
    
    for (const [key, database] of Object.entries(structure.databases)) {
      const data = await this.queryDatabase(database.id);
      databases[key] = {
        database: database,
        records: data.results
      };
    }

    return {
      clientName: structure.clientName,
      pages: structure.pages,
      databases,
      exportDate: new Date().toISOString()
    };
  }
}

export default NotionIntegration;