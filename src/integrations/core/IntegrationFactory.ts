/**
 * Integration Factory - Creates and manages integration instances
 */

import { BaseIntegration, IntegrationConfig, IntegrationManager } from './IntegrationFramework';
import { AsanaEnhancedIntegration } from '../asana/AsanaEnhancedIntegration';
import { GoogleEnhancedIntegration } from '../google/GoogleEnhancedIntegration';
import { NotionEnhancedIntegration } from '../notion/NotionEnhancedIntegration';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
import { EventEmitter } from 'events';

export type IntegrationType = 'asana' | 'google' | 'notion' | 'salesforce' | 'hubspot' | 'slack' | 'github' | 'jira' | 'custom';

export interface IntegrationFactoryConfig {
  swarmMemory: SwarmMemory;
  hitlSystem?: HITLSystem;
  defaultConfigs?: Record<IntegrationType, Partial<IntegrationConfig>>;
  autoInitialize?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

export interface IntegrationTemplate {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  requiredScopes?: string[];
  defaultConfig: Partial<IntegrationConfig>;
  setupSteps?: Array<{
    step: number;
    name: string;
    description: string;
    required: boolean;
  }>;
}

export class IntegrationFactory extends EventEmitter {
  private manager: IntegrationManager;
  private swarmMemory: SwarmMemory;
  private hitlSystem?: HITLSystem;
  private config: IntegrationFactoryConfig;
  private templates: Map<string, IntegrationTemplate> = new Map();
  private integrationCache: Map<string, BaseIntegration> = new Map();

  constructor(config: IntegrationFactoryConfig) {
    super();
    this.config = config;
    this.swarmMemory = config.swarmMemory;
    this.hitlSystem = config.hitlSystem;
    this.manager = new IntegrationManager(
      this.swarmMemory,
      this.hitlSystem
    );

    this.initializeTemplates();
    this.setupEventHandlers();
  }

  /**
   * Create an integration instance
   */
  public async createIntegration(
    type: IntegrationType,
    config: IntegrationConfig,
    options?: {
      templateId?: string;
      autoConnect?: boolean;
      enableSync?: boolean;
      customHandlers?: Record<string, (data: any) => Promise<void>>;
    }
  ): Promise<BaseIntegration> {
    try {
      // Check cache first
      const cacheKey = `${type}:${config.id}`;
      if (this.config.enableCaching && this.integrationCache.has(cacheKey)) {
        return this.integrationCache.get(cacheKey)!;
      }

      // Apply template if specified
      if (options?.templateId) {
        const template = this.templates.get(options.templateId);
        if (template) {
          config = this.applyTemplate(config, template);
        }
      }

      // Apply default config
      const defaultConfig = this.config.defaultConfigs?.[type];
      if (defaultConfig) {
        config = { ...defaultConfig, ...config };
      }

      // Create integration instance
      const integration = await this.createIntegrationInstance(type, config);

      // Setup custom handlers
      if (options?.customHandlers) {
        this.setupCustomHandlers(integration, options.customHandlers);
      }

      // Register with manager
      await this.manager.registerIntegration(integration);

      // Auto-connect if requested
      if (options?.autoConnect && this.config.autoInitialize) {
        await integration.initialize();
      }

      // Cache if enabled
      if (this.config.enableCaching) {
        this.integrationCache.set(cacheKey, integration);
      }

      // Store creation in memory
      await this.swarmMemory.store(`integration:created:${config.id}`, {
        type,
        config,
        options,
        createdAt: new Date()
      });

      this.emit('integration:created', { type, id: config.id, integration });
      return integration;

    } catch (error) {
      this.emit('integration:creation_failed', { type, config, error });
      throw error;
    }
  }

  /**
   * Create multiple integrations from a configuration
   */
  public async createBulkIntegrations(
    integrations: Array<{
      type: IntegrationType;
      config: IntegrationConfig;
      options?: any;
    }>
  ): Promise<Map<string, BaseIntegration>> {
    const results = new Map<string, BaseIntegration>();
    const errors = [];

    for (const integration of integrations) {
      try {
        const instance = await this.createIntegration(
          integration.type,
          integration.config,
          integration.options
        );
        results.set(integration.config.id, instance);
      } catch (error) {
        errors.push({
          id: integration.config.id,
          type: integration.type,
          error
        });
      }
    }

    if (errors.length > 0) {
      this.emit('bulk:creation_errors', { errors });
    }

    this.emit('bulk:creation_completed', { 
      total: integrations.length,
      successful: results.size,
      failed: errors.length
    });

    return results;
  }

  /**
   * Create an integration workflow (multiple integrated systems)
   */
  public async createIntegrationWorkflow(
    name: string,
    workflow: {
      integrations: Array<{
        type: IntegrationType;
        config: IntegrationConfig;
        role: 'source' | 'destination' | 'processor';
      }>;
      dataFlow: Array<{
        from: string;
        to: string;
        transformations?: Array<{
          type: string;
          config: any;
        }>;
      }>;
      triggers?: Array<{
        integration: string;
        event: string;
        conditions?: any;
      }>;
    }
  ): Promise<any> {
    try {
      const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const integrationMap = new Map<string, BaseIntegration>();

      // Create all integrations
      for (const integration of workflow.integrations) {
        const instance = await this.createIntegration(
          integration.type,
          integration.config,
          { autoConnect: true }
        );
        integrationMap.set(integration.config.id, instance);
      }

      // Setup data flow
      await this.setupDataFlow(integrationMap, workflow.dataFlow);

      // Setup triggers
      if (workflow.triggers) {
        await this.setupTriggers(integrationMap, workflow.triggers);
      }

      // Store workflow configuration
      const workflowConfig = {
        id: workflowId,
        name,
        workflow,
        integrations: Array.from(integrationMap.keys()),
        createdAt: new Date()
      };

      await this.swarmMemory.store(`workflow:${workflowId}`, workflowConfig);

      this.emit('workflow:created', { workflowId, name, integrations: integrationMap.size });
      return workflowConfig;

    } catch (error) {
      this.emit('workflow:creation_failed', { name, error });
      throw error;
    }
  }

  /**
   * Get integration templates
   */
  public getTemplates(): IntegrationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): IntegrationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Create custom template
   */
  public createTemplate(template: IntegrationTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template:created', { template });
  }

  /**
   * Get integration by ID
   */
  public getIntegration(integrationId: string): BaseIntegration | undefined {
    return this.manager.getIntegration(integrationId);
  }

  /**
   * Get all integrations
   */
  public getAllIntegrations(): BaseIntegration[] {
    return this.manager.getAllIntegrations();
  }

  /**
   * Get integrations by type
   */
  public getIntegrationsByType(type: IntegrationType): BaseIntegration[] {
    return this.manager.getAllIntegrations().filter(
      integration => this.getIntegrationType(integration) === type
    );
  }

  /**
   * Test all connections
   */
  public async testAllConnections(): Promise<Map<string, boolean>> {
    return await this.manager.testAllConnections();
  }

  /**
   * Get integration metrics
   */
  public getMetrics(): any {
    const metrics = this.manager.getMetrics();
    const summary = {
      totalIntegrations: this.manager.getAllIntegrations().length,
      byType: this.getIntegrationCountByType(),
      healthStatus: this.getHealthStatus(),
      metrics
    };

    return summary;
  }

  /**
   * Create RevOps Suite (pre-configured set of integrations)
   */
  public async createRevOpsSuite(
    clientName: string,
    options?: {
      includeAsana?: boolean;
      includeGoogle?: boolean;
      includeNotion?: boolean;
      includeCRM?: boolean;
      customConfig?: Record<string, any>;
    }
  ): Promise<Map<string, BaseIntegration>> {
    const suite = new Map<string, BaseIntegration>();

    try {
      // Create Asana integration
      if (options?.includeAsana !== false) {
        const asana = await this.createIntegration('asana', {
          id: `asana-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${clientName} - Asana`,
          type: 'api_key',
          baseUrl: 'https://app.asana.com/api/1.0',
          authConfig: {
            type: 'api_key',
            apiKey: {
              key: options?.customConfig?.asanaApiKey || '',
              placement: 'header',
              headerName: 'Authorization'
            }
          },
          ...options?.customConfig?.asana
        }, {
          templateId: 'revops-asana',
          autoConnect: true
        });
        suite.set('asana', asana);
      }

      // Create Google Workspace integration
      if (options?.includeGoogle !== false) {
        const google = await this.createIntegration('google', {
          id: `google-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${clientName} - Google Workspace`,
          type: 'oauth2',
          baseUrl: 'https://www.googleapis.com',
          authConfig: {
            type: 'oauth2',
            oauth2: {
              clientId: options?.customConfig?.googleClientId || '',
              clientSecret: options?.customConfig?.googleClientSecret || '',
              authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
              tokenUrl: 'https://oauth2.googleapis.com/token',
              scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/calendar'
              ],
              redirectUri: options?.customConfig?.googleRedirectUri || 'http://localhost:3000/auth/callback',
              grantType: 'authorization_code'
            }
          },
          ...options?.customConfig?.google
        }, {
          templateId: 'revops-google',
          autoConnect: true
        });
        suite.set('google', google);
      }

      // Create Notion integration
      if (options?.includeNotion !== false) {
        const notion = await this.createIntegration('notion', {
          id: `notion-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${clientName} - Notion`,
          type: 'api_key',
          baseUrl: 'https://api.notion.com/v1',
          authConfig: {
            type: 'api_key',
            apiKey: {
              key: options?.customConfig?.notionApiKey || '',
              placement: 'header',
              headerName: 'Authorization'
            }
          },
          ...options?.customConfig?.notion
        }, {
          templateId: 'revops-notion',
          autoConnect: true
        });
        suite.set('notion', notion);
      }

      // Create workflow connecting all integrations
      if (suite.size > 1) {
        await this.createIntegrationWorkflow(`${clientName} - RevOps Workflow`, {
          integrations: Array.from(suite.entries()).map(([key, integration]) => ({
            type: key as IntegrationType,
            config: integration['config'],
            role: key === 'asana' ? 'source' : 'destination'
          })),
          dataFlow: this.createRevOpsDataFlow(suite),
          triggers: this.createRevOpsTriggers(suite)
        });
      }

      this.emit('revops:suite_created', { 
        clientName, 
        integrations: Array.from(suite.keys()) 
      });

      return suite;

    } catch (error) {
      this.emit('revops:suite_creation_failed', { clientName, error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private initializeTemplates(): void {
    // RevOps Asana Template
    this.templates.set('revops-asana', {
      id: 'revops-asana',
      name: 'RevOps Asana Template',
      type: 'asana',
      description: 'Pre-configured Asana integration for RevOps workflows',
      requiredScopes: ['default'],
      defaultConfig: {
        rateLimiting: {
          maxRequests: 1500,
          windowMs: 60000,
          strategy: 'sliding',
          respectRetryAfter: true
        },
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffFactor: 2,
          retryableStatuses: [429, 500, 502, 503, 504],
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
        },
        cacheConfig: {
          enabled: true,
          ttlMs: 300000,
          maxSize: 100,
          strategy: 'lru'
        }
      },
      setupSteps: [
        { step: 1, name: 'API Key', description: 'Enter your Asana API key', required: true },
        { step: 2, name: 'Workspace', description: 'Select default workspace', required: true },
        { step: 3, name: 'Templates', description: 'Configure project templates', required: false }
      ]
    });

    // RevOps Google Template
    this.templates.set('revops-google', {
      id: 'revops-google',
      name: 'RevOps Google Workspace Template',
      type: 'google',
      description: 'Pre-configured Google Workspace integration for RevOps',
      requiredScopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar'
      ],
      defaultConfig: {
        timeout: 30000,
        maxConcurrentRequests: 10,
        cacheConfig: {
          enabled: true,
          ttlMs: 600000,
          maxSize: 200,
          strategy: 'lru'
        }
      },
      setupSteps: [
        { step: 1, name: 'OAuth Setup', description: 'Configure OAuth2 credentials', required: true },
        { step: 2, name: 'Authorize', description: 'Authorize access to Google Workspace', required: true },
        { step: 3, name: 'Templates', description: 'Select document templates', required: false }
      ]
    });

    // RevOps Notion Template
    this.templates.set('revops-notion', {
      id: 'revops-notion',
      name: 'RevOps Notion Template',
      type: 'notion',
      description: 'Pre-configured Notion integration for knowledge management',
      defaultConfig: {
        version: '2022-06-28',
        rateLimiting: {
          maxRequests: 3,
          windowMs: 1000,
          strategy: 'fixed',
          respectRetryAfter: true
        },
        cacheConfig: {
          enabled: true,
          ttlMs: 300000,
          maxSize: 150,
          strategy: 'ttl'
        }
      },
      setupSteps: [
        { step: 1, name: 'API Key', description: 'Enter your Notion integration token', required: true },
        { step: 2, name: 'Databases', description: 'Configure database templates', required: false },
        { step: 3, name: 'Automations', description: 'Setup automation rules', required: false }
      ]
    });
  }

  private async createIntegrationInstance(
    type: IntegrationType,
    config: IntegrationConfig
  ): Promise<BaseIntegration> {
    switch (type) {
      case 'asana':
        return new AsanaEnhancedIntegration(config as any, this.swarmMemory, this.hitlSystem);
      
      case 'google':
        return new GoogleEnhancedIntegration(config as any, this.swarmMemory, this.hitlSystem);
      
      case 'notion':
        return new NotionEnhancedIntegration(config as any, this.swarmMemory, this.hitlSystem);
      
      // Add other integration types as they are implemented
      case 'salesforce':
      case 'hubspot':
      case 'slack':
      case 'github':
      case 'jira':
        throw new Error(`Integration type ${type} not yet implemented`);
      
      case 'custom':
        throw new Error('Custom integrations must extend BaseIntegration directly');
      
      default:
        throw new Error(`Unknown integration type: ${type}`);
    }
  }

  private applyTemplate(
    config: IntegrationConfig,
    template: IntegrationTemplate
  ): IntegrationConfig {
    return {
      ...template.defaultConfig,
      ...config,
      // Merge nested configs
      authConfig: {
        ...template.defaultConfig.authConfig,
        ...config.authConfig
      },
      rateLimiting: {
        ...template.defaultConfig.rateLimiting,
        ...config.rateLimiting
      },
      retryConfig: {
        ...template.defaultConfig.retryConfig,
        ...config.retryConfig
      },
      cacheConfig: {
        ...template.defaultConfig.cacheConfig,
        ...config.cacheConfig
      }
    };
  }

  private setupCustomHandlers(
    integration: BaseIntegration,
    handlers: Record<string, (data: any) => Promise<void>>
  ): void {
    for (const [event, handler] of Object.entries(handlers)) {
      integration.on(event, handler);
    }
  }

  private async setupDataFlow(
    integrations: Map<string, BaseIntegration>,
    dataFlow: any[]
  ): Promise<void> {
    // Setup data flow between integrations
    // This would involve setting up event handlers and data transformations
    for (const flow of dataFlow) {
      const source = integrations.get(flow.from);
      const destination = integrations.get(flow.to);

      if (source && destination) {
        // Setup data flow handler
        source.on('data:available', async (data) => {
          let transformedData = data;
          
          // Apply transformations
          if (flow.transformations) {
            for (const transformation of flow.transformations) {
              transformedData = await this.applyTransformation(
                transformedData,
                transformation
              );
            }
          }

          // Send to destination
          await this.sendToDestination(destination, transformedData);
        });
      }
    }
  }

  private async setupTriggers(
    integrations: Map<string, BaseIntegration>,
    triggers: any[]
  ): Promise<void> {
    for (const trigger of triggers) {
      const integration = integrations.get(trigger.integration);
      
      if (integration) {
        integration.on(trigger.event, async (data) => {
          // Check conditions
          if (this.checkTriggerConditions(data, trigger.conditions)) {
            this.emit('workflow:triggered', {
              integration: trigger.integration,
              event: trigger.event,
              data
            });
          }
        });
      }
    }
  }

  private async applyTransformation(data: any, transformation: any): Promise<any> {
    // Apply data transformation
    // This is a placeholder - would implement actual transformation logic
    return data;
  }

  private async sendToDestination(
    destination: BaseIntegration,
    data: any
  ): Promise<void> {
    // Send data to destination integration
    // This would use the appropriate method based on integration type
    destination.emit('data:received', data);
  }

  private checkTriggerConditions(data: any, conditions: any): boolean {
    // Check if trigger conditions are met
    // This is a placeholder - would implement actual condition checking
    return true;
  }

  private getIntegrationType(integration: BaseIntegration): IntegrationType {
    // Determine integration type from instance
    if (integration instanceof AsanaEnhancedIntegration) return 'asana';
    if (integration instanceof GoogleEnhancedIntegration) return 'google';
    if (integration instanceof NotionEnhancedIntegration) return 'notion';
    return 'custom';
  }

  private getIntegrationCountByType(): Record<IntegrationType, number> {
    const counts: Record<string, number> = {};
    
    for (const integration of this.manager.getAllIntegrations()) {
      const type = this.getIntegrationType(integration);
      counts[type] = (counts[type] || 0) + 1;
    }

    return counts as Record<IntegrationType, number>;
  }

  private getHealthStatus(): any {
    const integrations = this.manager.getAllIntegrations();
    let healthy = 0;
    let unhealthy = 0;

    for (const integration of integrations) {
      if (integration.isConnected()) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: integrations.length,
      healthPercentage: integrations.length > 0 
        ? (healthy / integrations.length) * 100 
        : 0
    };
  }

  private createRevOpsDataFlow(suite: Map<string, BaseIntegration>): any[] {
    const dataFlow = [];

    // Asana to Notion sync
    if (suite.has('asana') && suite.has('notion')) {
      dataFlow.push({
        from: suite.get('asana')!['config'].id,
        to: suite.get('notion')!['config'].id,
        transformations: [{
          type: 'field_mapping',
          config: {
            'name': 'title',
            'notes': 'description',
            'assignee': 'owner'
          }
        }]
      });
    }

    // Asana to Google sync
    if (suite.has('asana') && suite.has('google')) {
      dataFlow.push({
        from: suite.get('asana')!['config'].id,
        to: suite.get('google')!['config'].id,
        transformations: [{
          type: 'document_generation',
          config: {
            template: 'project_report'
          }
        }]
      });
    }

    return dataFlow;
  }

  private createRevOpsTriggers(suite: Map<string, BaseIntegration>): any[] {
    const triggers = [];

    // Asana triggers
    if (suite.has('asana')) {
      triggers.push({
        integration: suite.get('asana')!['config'].id,
        event: 'asana:project_created',
        conditions: { type: 'revops_project' }
      });
    }

    // Google triggers
    if (suite.has('google')) {
      triggers.push({
        integration: suite.get('google')!['config'].id,
        event: 'google:document_created',
        conditions: { folder: 'revops' }
      });
    }

    return triggers;
  }

  private setupEventHandlers(): void {
    // Forward manager events
    this.manager.on('integration:registered', (data) => {
      this.emit('factory:integration_registered', data);
    });

    this.manager.on('integration:request_success', (data) => {
      if (this.config.enableMetrics) {
        this.updateMetrics('request_success', data);
      }
    });

    this.manager.on('integration:request_failed', (data) => {
      if (this.config.enableMetrics) {
        this.updateMetrics('request_failed', data);
      }
    });
  }

  private updateMetrics(event: string, data: any): void {
    // Update metrics in swarm memory
    this.swarmMemory.store(`metrics:integration:${event}:${Date.now()}`, {
      event,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup all integrations
   */
  public async cleanup(): Promise<void> {
    await this.manager.cleanup();
    this.integrationCache.clear();
    this.emit('factory:cleanup_completed');
  }
}

export default IntegrationFactory;