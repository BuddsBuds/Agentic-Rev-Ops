/**
 * Integration Hub - Central management for all external integrations
 * Provides unified interface for RevOps platform integrations
 */

import { EventEmitter } from 'events';
import { IntegrationFactory, IntegrationType } from './core/IntegrationFactory';
import { BaseIntegration, IntegrationConfig } from './core/IntegrationFramework';
import { SwarmMemory } from '../swarm/memory/SwarmMemory';
import { HITLSystem } from '../workflow/hitl/HITLSystem';
import { SwarmCoordinator } from '../swarm/coordinator/SwarmCoordinator';

export interface IntegrationHubConfig {
  enableAutoDiscovery?: boolean;
  enableHealthMonitoring?: boolean;
  healthCheckInterval?: number;
  enableWebhooks?: boolean;
  webhookPort?: number;
  enableMetrics?: boolean;
  metricsInterval?: number;
  maxIntegrations?: number;
  defaultTimeout?: number;
}

export interface IntegrationHubStatus {
  status: 'running' | 'degraded' | 'maintenance' | 'stopped';
  totalIntegrations: number;
  activeIntegrations: number;
  healthyIntegrations: number;
  metrics: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    lastHealthCheck: Date;
  };
  integrations: Array<{
    id: string;
    type: IntegrationType;
    status: 'connected' | 'disconnected' | 'error';
    health: boolean;
  }>;
}

export interface IntegrationWebhook {
  id: string;
  integrationId: string;
  endpoint: string;
  events: string[];
  secret?: string;
  active: boolean;
  lastTriggered?: Date;
}

export class IntegrationHub extends EventEmitter {
  private factory: IntegrationFactory;
  private swarmMemory: SwarmMemory;
  private hitlSystem?: HITLSystem;
  private swarmCoordinator?: SwarmCoordinator;
  private config: IntegrationHubConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private webhooks: Map<string, IntegrationWebhook> = new Map();
  private status: IntegrationHubStatus['status'] = 'stopped';
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0
  };

  constructor(
    swarmMemory: SwarmMemory,
    hitlSystem?: HITLSystem,
    swarmCoordinator?: SwarmCoordinator,
    config: IntegrationHubConfig = {}
  ) {
    super();
    
    this.swarmMemory = swarmMemory;
    this.hitlSystem = hitlSystem;
    this.swarmCoordinator = swarmCoordinator;
    this.config = {
      enableAutoDiscovery: true,
      enableHealthMonitoring: true,
      healthCheckInterval: 60000, // 1 minute
      enableWebhooks: true,
      webhookPort: 3001,
      enableMetrics: true,
      metricsInterval: 300000, // 5 minutes
      maxIntegrations: 50,
      defaultTimeout: 30000,
      ...config
    };

    // Initialize factory
    this.factory = new IntegrationFactory({
      swarmMemory: this.swarmMemory,
      hitlSystem: this.hitlSystem,
      autoInitialize: true,
      enableMetrics: this.config.enableMetrics,
      enableCaching: true
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the Integration Hub
   */
  public async initialize(): Promise<void> {
    try {
      this.emit('hub:initializing');

      // Load existing integrations from memory
      await this.loadExistingIntegrations();

      // Start health monitoring
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      // Start metrics collection
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Setup webhook server if enabled
      if (this.config.enableWebhooks) {
        await this.setupWebhookServer();
      }

      // Auto-discover integrations if enabled
      if (this.config.enableAutoDiscovery) {
        await this.autoDiscoverIntegrations();
      }

      this.status = 'running';
      this.emit('hub:initialized', this.getStatus());

      // Store initialization in memory
      await this.swarmMemory.store('integration_hub:initialized', {
        config: this.config,
        timestamp: new Date()
      });

    } catch (error) {
      this.status = 'degraded';
      this.emit('hub:initialization_failed', { error });
      throw error;
    }
  }

  /**
   * Add a new integration
   */
  public async addIntegration(
    type: IntegrationType,
    config: IntegrationConfig,
    options?: any
  ): Promise<BaseIntegration> {
    try {
      // Check integration limit
      if (this.factory.getAllIntegrations().length >= this.config.maxIntegrations!) {
        throw new Error(`Maximum integration limit (${this.config.maxIntegrations}) reached`);
      }

      // Create integration
      const integration = await this.factory.createIntegration(type, config, options);

      // Setup integration-specific event handlers
      this.setupIntegrationHandlers(integration);

      // Create webhooks if configured
      if (this.config.enableWebhooks && options?.webhooks) {
        await this.createIntegrationWebhooks(config.id, options.webhooks);
      }

      // Notify swarm if available
      if (this.swarmCoordinator) {
        await this.notifySwarmOfIntegration(integration);
      }

      this.emit('integration:added', {
        id: config.id,
        type,
        integration
      });

      return integration;

    } catch (error) {
      this.emit('integration:add_failed', { type, config, error });
      throw error;
    }
  }

  /**
   * Remove an integration
   */
  public async removeIntegration(integrationId: string): Promise<void> {
    try {
      const integration = this.factory.getIntegration(integrationId);
      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      // Remove webhooks
      await this.removeIntegrationWebhooks(integrationId);

      // Cleanup integration
      await integration.cleanup();

      // Remove from factory
      await this.factory['manager'].unregisterIntegration(integrationId);

      this.emit('integration:removed', { integrationId });

    } catch (error) {
      this.emit('integration:remove_failed', { integrationId, error });
      throw error;
    }
  }

  /**
   * Create a RevOps client suite
   */
  public async createClientSuite(
    clientName: string,
    options?: {
      integrations?: {
        asana?: boolean;
        google?: boolean;
        notion?: boolean;
        crm?: boolean;
      };
      credentials?: {
        asanaApiKey?: string;
        googleClientId?: string;
        googleClientSecret?: string;
        googleRedirectUri?: string;
        notionApiKey?: string;
        crmApiKey?: string;
      };
      autoSetup?: boolean;
    }
  ): Promise<Map<string, BaseIntegration>> {
    try {
      this.emit('suite:creating', { clientName });

      // Create suite using factory
      const suite = await this.factory.createRevOpsSuite(clientName, {
        includeAsana: options?.integrations?.asana,
        includeGoogle: options?.integrations?.google,
        includeNotion: options?.integrations?.notion,
        includeCRM: options?.integrations?.crm,
        customConfig: options?.credentials
      });

      // Auto-setup if requested
      if (options?.autoSetup) {
        await this.setupClientWorkspace(clientName, suite);
      }

      // Create unified dashboard
      await this.createUnifiedDashboard(clientName, suite);

      this.emit('suite:created', {
        clientName,
        integrations: Array.from(suite.keys())
      });

      return suite;

    } catch (error) {
      this.emit('suite:creation_failed', { clientName, error });
      throw error;
    }
  }

  /**
   * Get integration by ID
   */
  public getIntegration(integrationId: string): BaseIntegration | undefined {
    return this.factory.getIntegration(integrationId);
  }

  /**
   * Get all integrations
   */
  public getAllIntegrations(): BaseIntegration[] {
    return this.factory.getAllIntegrations();
  }

  /**
   * Get integrations by type
   */
  public getIntegrationsByType(type: IntegrationType): BaseIntegration[] {
    return this.factory.getIntegrationsByType(type);
  }

  /**
   * Test all connections
   */
  public async testAllConnections(): Promise<Map<string, boolean>> {
    this.emit('connections:testing');
    const results = await this.factory.testAllConnections();
    this.emit('connections:tested', { results });
    return results;
  }

  /**
   * Get hub status
   */
  public getStatus(): IntegrationHubStatus {
    const integrations = this.factory.getAllIntegrations();
    const metrics = this.factory.getMetrics();

    const integrationStatuses = integrations.map(integration => {
      const type = this.getIntegrationType(integration);
      return {
        id: integration['config'].id,
        type,
        status: integration.isConnected() ? 'connected' as const : 'disconnected' as const,
        health: integration.isConnected()
      };
    });

    const healthyCount = integrationStatuses.filter(i => i.health).length;
    const activeCount = integrationStatuses.filter(i => i.status === 'connected').length;

    return {
      status: this.status,
      totalIntegrations: integrations.length,
      activeIntegrations: activeCount,
      healthyIntegrations: healthyCount,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successRate: this.metrics.totalRequests > 0 
          ? this.metrics.successfulRequests / this.metrics.totalRequests 
          : 1,
        averageResponseTime: this.metrics.totalRequests > 0
          ? this.metrics.totalResponseTime / this.metrics.totalRequests
          : 0,
        lastHealthCheck: new Date()
      },
      integrations: integrationStatuses
    };
  }

  /**
   * Create webhook for integration
   */
  public async createWebhook(
    integrationId: string,
    config: {
      endpoint: string;
      events: string[];
      secret?: string;
    }
  ): Promise<IntegrationWebhook> {
    const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const webhook: IntegrationWebhook = {
      id: webhookId,
      integrationId,
      endpoint: config.endpoint,
      events: config.events,
      secret: config.secret,
      active: true
    };

    this.webhooks.set(webhookId, webhook);

    // Store in memory
    await this.swarmMemory.store(`webhook:${webhookId}`, webhook);

    this.emit('webhook:created', { webhook });
    return webhook;
  }

  /**
   * Handle incoming webhook
   */
  public async handleWebhook(
    integrationId: string,
    event: string,
    data: any,
    signature?: string
  ): Promise<void> {
    try {
      // Find matching webhooks
      const matchingWebhooks = Array.from(this.webhooks.values()).filter(
        webhook => webhook.integrationId === integrationId && 
                  webhook.events.includes(event) &&
                  webhook.active
      );

      // Process each webhook
      for (const webhook of matchingWebhooks) {
        await this.processWebhook(webhook, event, data, signature);
      }

      this.emit('webhook:processed', { integrationId, event, webhookCount: matchingWebhooks.length });

    } catch (error) {
      this.emit('webhook:processing_failed', { integrationId, event, error });
      throw error;
    }
  }

  /**
   * Sync data between integrations
   */
  public async syncIntegrations(
    sourceId: string,
    targetId: string,
    options?: {
      dataType?: string;
      filter?: any;
      transform?: (data: any) => any;
      bidirectional?: boolean;
    }
  ): Promise<void> {
    try {
      const source = this.factory.getIntegration(sourceId);
      const target = this.factory.getIntegration(targetId);

      if (!source || !target) {
        throw new Error('Source or target integration not found');
      }

      this.emit('sync:started', { sourceId, targetId });

      // Implement sync logic based on integration types
      // This is a placeholder - actual implementation would depend on integration types

      this.emit('sync:completed', { sourceId, targetId });

    } catch (error) {
      this.emit('sync:failed', { sourceId, targetId, error });
      throw error;
    }
  }

  /**
   * Enable maintenance mode
   */
  public async enableMaintenanceMode(reason: string): Promise<void> {
    this.status = 'maintenance';
    
    // Pause all health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Notify all integrations
    for (const integration of this.factory.getAllIntegrations()) {
      integration.emit('maintenance:enabled', { reason });
    }

    await this.swarmMemory.store('integration_hub:maintenance', {
      enabled: true,
      reason,
      timestamp: new Date()
    });

    this.emit('maintenance:enabled', { reason });
  }

  /**
   * Disable maintenance mode
   */
  public async disableMaintenanceMode(): Promise<void> {
    this.status = 'running';
    
    // Resume health checks
    if (this.config.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    await this.swarmMemory.store('integration_hub:maintenance', {
      enabled: false,
      timestamp: new Date()
    });

    this.emit('maintenance:disabled');
  }

  /**
   * Shutdown the hub
   */
  public async shutdown(): Promise<void> {
    this.emit('hub:shutting_down');
    
    this.status = 'stopped';

    // Stop intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Cleanup all integrations
    await this.factory.cleanup();

    await this.swarmMemory.store('integration_hub:shutdown', {
      timestamp: new Date(),
      finalMetrics: this.metrics
    });

    this.emit('hub:shutdown');
  }

  /**
   * Private helper methods
   */

  private setupEventHandlers(): void {
    // Factory events
    this.factory.on('integration:created', (data) => {
      this.emit('hub:integration_created', data);
    });

    this.factory.on('integration:creation_failed', (data) => {
      this.emit('hub:integration_creation_failed', data);
    });

    this.factory.on('workflow:created', (data) => {
      this.emit('hub:workflow_created', data);
    });

    // Integration events
    this.factory['manager'].on('integration:request_success', (data) => {
      this.updateMetrics('success');
    });

    this.factory['manager'].on('integration:request_failed', (data) => {
      this.updateMetrics('failure');
    });

    this.factory['manager'].on('integration:rate_limit', (data) => {
      this.emit('hub:rate_limit', data);
    });
  }

  private setupIntegrationHandlers(integration: BaseIntegration): void {
    // Setup common event handlers for all integrations
    integration.on('error', (error) => {
      this.emit('integration:error', {
        integrationId: integration['config'].id,
        error
      });
    });

    integration.on('health:checked', (data) => {
      this.emit('integration:health_checked', data);
    });
  }

  private async loadExistingIntegrations(): Promise<void> {
    // Load integrations from memory
    const integrationKeys = await this.swarmMemory.list('integration:created:*');
    
    for (const key of integrationKeys) {
      const data = await this.swarmMemory.retrieve(key);
      if (data) {
        try {
          await this.factory.createIntegration(data.type, data.config, data.options);
        } catch (error) {
          this.emit('integration:load_failed', { key, error });
        }
      }
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval!);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const results = await this.factory.testAllConnections();
      
      const unhealthyCount = Array.from(results.values()).filter(healthy => !healthy).length;
      if (unhealthyCount > 0) {
        this.status = 'degraded';
      } else if (this.status === 'degraded') {
        this.status = 'running';
      }

      this.emit('health:checked', { results, status: this.status });

    } catch (error) {
      this.emit('health:check_failed', { error });
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.metricsInterval!);
  }

  private async collectMetrics(): Promise<void> {
    const integrationMetrics = this.factory.getMetrics();
    
    await this.swarmMemory.store(`metrics:hub:${Date.now()}`, {
      hubMetrics: this.metrics,
      integrationMetrics,
      status: this.getStatus(),
      timestamp: new Date()
    });

    this.emit('metrics:collected', { metrics: integrationMetrics });
  }

  private updateMetrics(result: 'success' | 'failure'): void {
    this.metrics.totalRequests++;
    
    if (result === 'success') {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
  }

  private async setupWebhookServer(): Promise<void> {
    // Setup webhook server
    // This would typically use Express or similar to receive webhooks
    this.emit('webhook:server_started', { port: this.config.webhookPort });
  }

  private async autoDiscoverIntegrations(): Promise<void> {
    // Auto-discover available integrations
    // This could check environment variables, config files, etc.
    this.emit('discovery:completed');
  }

  private async createIntegrationWebhooks(
    integrationId: string,
    webhookConfigs: any[]
  ): Promise<void> {
    for (const config of webhookConfigs) {
      await this.createWebhook(integrationId, config);
    }
  }

  private async removeIntegrationWebhooks(integrationId: string): Promise<void> {
    const webhooksToRemove = Array.from(this.webhooks.entries())
      .filter(([_, webhook]) => webhook.integrationId === integrationId)
      .map(([id, _]) => id);

    for (const webhookId of webhooksToRemove) {
      this.webhooks.delete(webhookId);
    }
  }

  private async processWebhook(
    webhook: IntegrationWebhook,
    event: string,
    data: any,
    signature?: string
  ): Promise<void> {
    // Verify signature if configured
    if (webhook.secret && signature) {
      // Implement signature verification
    }

    // Update last triggered time
    webhook.lastTriggered = new Date();

    // Process webhook based on endpoint type
    // This is a placeholder - actual implementation would make HTTP requests
    this.emit('webhook:triggered', { webhook, event, data });
  }

  private async notifySwarmOfIntegration(integration: BaseIntegration): Promise<void> {
    if (!this.swarmCoordinator) return;

    await this.swarmCoordinator.broadcast({
      type: 'integration_added',
      data: {
        integrationId: integration['config'].id,
        integrationType: this.getIntegrationType(integration),
        timestamp: new Date()
      }
    });
  }

  private async setupClientWorkspace(
    clientName: string,
    suite: Map<string, BaseIntegration>
  ): Promise<void> {
    // Setup workspace in each integration
    for (const [type, integration] of suite) {
      switch (type) {
        case 'asana':
          const asana = integration as any;
          await asana.createRevOpsProject(clientName);
          break;
        
        case 'google':
          const google = integration as any;
          await google.createRevOpsWorkspace(clientName);
          break;
        
        case 'notion':
          const notion = integration as any;
          await notion.createRevOpsKnowledgeBase(clientName);
          break;
      }
    }
  }

  private async createUnifiedDashboard(
    clientName: string,
    suite: Map<string, BaseIntegration>
  ): Promise<void> {
    // Create unified dashboard if Google integration exists
    const google = suite.get('google');
    if (google) {
      const googleIntegration = google as any;
      await googleIntegration.createDataDashboard(
        `${clientName} - Unified RevOps Dashboard`,
        {
          type: 'custom',
          query: {
            integrations: Array.from(suite.keys())
          }
        }
      );
    }
  }

  private getIntegrationType(integration: BaseIntegration): IntegrationType {
    // Get integration type from config or class
    return integration['config'].type as IntegrationType || 'custom';
  }

  /**
   * Get webhook by ID
   */
  public getWebhook(webhookId: string): IntegrationWebhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Get all webhooks
   */
  public getAllWebhooks(): IntegrationWebhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Disable webhook
   */
  public async disableWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      webhook.active = false;
      await this.swarmMemory.store(`webhook:${webhookId}`, webhook);
      this.emit('webhook:disabled', { webhookId });
    }
  }

  /**
   * Enable webhook
   */
  public async enableWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      webhook.active = true;
      await this.swarmMemory.store(`webhook:${webhookId}`, webhook);
      this.emit('webhook:enabled', { webhookId });
    }
  }
}

export default IntegrationHub;