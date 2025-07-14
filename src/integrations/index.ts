/**
 * Integration Module - Central export for all integration components
 */

// Core Framework
export * from './core/IntegrationFramework';
export * from './core/IntegrationFactory';
export * from './IntegrationHub';

// Enhanced Integrations
export * from './asana/asana-integration';
export * from './asana/AsanaEnhancedIntegration';
export * from './google/google-workspace-integration';
export * from './google/GoogleEnhancedIntegration';
export * from './notion/notion-integration';
export * from './notion/NotionEnhancedIntegration';

// Utilities
export * from './data-integration-engine';
export * from './data-pipelines/pipeline-engine';
export * from './data-pipelines/realtime-processor';
export * from './transformation/data-transformer';

// CRM Integrations
export * from './crm/crm-integration';
export * from './crm/salesforce-integration';

// Marketing Integrations
export * from './marketing-automation/marketing-integration';

// Default exports
export { default as IntegrationManager } from './core/IntegrationFramework';
export { default as IntegrationFactory } from './core/IntegrationFactory';
export { default as IntegrationHub } from './IntegrationHub';
export { default as AsanaIntegration } from './asana/asana-integration';
export { default as AsanaEnhancedIntegration } from './asana/AsanaEnhancedIntegration';
export { default as GoogleWorkspaceIntegration } from './google/google-workspace-integration';
export { default as GoogleEnhancedIntegration } from './google/GoogleEnhancedIntegration';
export { default as NotionIntegration } from './notion/notion-integration';
export { default as NotionEnhancedIntegration } from './notion/NotionEnhancedIntegration';