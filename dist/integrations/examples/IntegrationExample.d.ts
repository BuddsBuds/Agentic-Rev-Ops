import { IntegrationHub } from '../IntegrationHub';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
import { DatabaseConnectionManager } from '../../core/database/connection';
declare function setupIntegrations(): Promise<{
    integrationHub: IntegrationHub;
    swarmMemory: SwarmMemory;
    hitlSystem: HITLSystem;
    dbManager: DatabaseConnectionManager;
}>;
declare function exampleBasicIntegration(integrationHub: IntegrationHub): Promise<import("..").BaseIntegration>;
declare function exampleClientSuite(integrationHub: IntegrationHub): Promise<Map<string, import("..").BaseIntegration>>;
declare function exampleEnhancedAsanaOperations(integrationHub: IntegrationHub): Promise<any>;
declare function exampleGoogleWorkspaceOperations(integrationHub: IntegrationHub): Promise<any>;
declare function exampleNotionKnowledgeBase(integrationHub: IntegrationHub): Promise<any>;
declare function exampleCrossPlatformSync(integrationHub: IntegrationHub): Promise<void>;
declare function exampleIntegrationWorkflow(integrationHub: IntegrationHub): Promise<void>;
declare function exampleMonitoringAndMetrics(integrationHub: IntegrationHub): Promise<void>;
export { setupIntegrations, exampleBasicIntegration, exampleClientSuite, exampleEnhancedAsanaOperations, exampleGoogleWorkspaceOperations, exampleNotionKnowledgeBase, exampleCrossPlatformSync, exampleIntegrationWorkflow, exampleMonitoringAndMetrics };
//# sourceMappingURL=IntegrationExample.d.ts.map