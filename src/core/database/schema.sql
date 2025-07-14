-- Agentic RevOps Production Database Schema
-- Supports PostgreSQL with proper indexing, constraints, and data governance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas for logical separation
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS swarm;
CREATE SCHEMA IF NOT EXISTS integrations;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- ==================================================
-- CORE SCHEMA: Fundamental business entities
-- ==================================================

-- Organizations/Tenants for multi-tenancy
CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('basic', 'professional', 'enterprise'))
);

-- Users with RBAC support
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '[]',
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'analyst', 'user', 'viewer'))
);

-- OAuth providers and external authentication
CREATE TABLE core.auth_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(provider, provider_id)
);

-- Client organizations and accounts
CREATE TABLE core.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    size_category VARCHAR(50),
    annual_revenue BIGINT,
    tier VARCHAR(50) DEFAULT 'standard',
    health_score DECIMAL(3,2) DEFAULT 0.5,
    risk_level VARCHAR(20) DEFAULT 'medium',
    contract_start_date DATE,
    contract_end_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_tier CHECK (tier IN ('basic', 'standard', 'premium', 'enterprise')),
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_health_score CHECK (health_score >= 0 AND health_score <= 1)
);

-- Client contacts and stakeholders
CREATE TABLE core.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES core.clients(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title VARCHAR(150),
    department VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    engagement_score DECIMAL(3,2) DEFAULT 0.5,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(client_id, email)
);

-- Revenue opportunities and deals
CREATE TABLE core.opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES core.clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    value_usd BIGINT NOT NULL,
    probability DECIMAL(3,2) DEFAULT 0.5,
    stage VARCHAR(50) NOT NULL,
    close_date DATE,
    owner_id UUID REFERENCES core.users(id),
    source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_probability CHECK (probability >= 0 AND probability <= 1),
    CONSTRAINT valid_stage CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'))
);

-- ==================================================
-- SWARM SCHEMA: AI agent coordination and decisions
-- ==================================================

-- Swarm configurations and topologies
CREATE TABLE swarm.swarm_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    topology VARCHAR(50) NOT NULL,
    max_agents INTEGER DEFAULT 8,
    strategy VARCHAR(50) DEFAULT 'consensus',
    voting_threshold DECIMAL(3,2) DEFAULT 0.7,
    auto_execution_threshold DECIMAL(3,2) DEFAULT 0.8,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_topology CHECK (topology IN ('hierarchical', 'mesh', 'ring', 'star')),
    CONSTRAINT valid_strategy CHECK (strategy IN ('consensus', 'majority', 'weighted', 'adaptive'))
);

-- AI agents within swarms
CREATE TABLE swarm.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    capabilities JSONB DEFAULT '[]',
    weight DECIMAL(3,2) DEFAULT 1.0,
    status VARCHAR(20) DEFAULT 'active',
    performance_score DECIMAL(3,2) DEFAULT 0.5,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_agent_type CHECK (type IN ('coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'idle', 'busy', 'error', 'disabled'))
);

-- Swarm decisions and voting records
CREATE TABLE swarm.decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL,
    context JSONB NOT NULL,
    winning_option JSONB,
    confidence_score DECIMAL(3,2),
    participation_rate DECIMAL(3,2),
    legitimacy VARCHAR(20) DEFAULT 'valid',
    requires_human_approval BOOLEAN DEFAULT false,
    human_approved BOOLEAN,
    human_approver_id UUID REFERENCES core.users(id),
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_legitimacy CHECK (legitimacy IN ('valid', 'invalid', 'contested'))
);

-- Individual agent votes for decisions
CREATE TABLE swarm.agent_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id UUID NOT NULL REFERENCES swarm.decisions(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES swarm.agents(id) ON DELETE CASCADE,
    option JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    reasoning TEXT,
    weight DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(decision_id, agent_id)
);

-- Swarm memory for pattern recognition and learning
CREATE TABLE swarm.memory_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    entry_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    relevance DECIMAL(3,2) DEFAULT 0.5,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_entry_type CHECK (entry_type IN ('decision', 'pattern', 'agent-report', 'task-result', 'learning'))
);

-- Neural patterns and learned behaviors
CREATE TABLE swarm.neural_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    occurrences INTEGER DEFAULT 1,
    success_rate DECIMAL(3,2) DEFAULT 0.5,
    confidence DECIMAL(3,2) DEFAULT 0.5,
    last_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- INTEGRATIONS SCHEMA: External system connections
-- ==================================================

-- Data source configurations
CREATE TABLE integrations.data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    sync_strategy VARCHAR(20) DEFAULT 'batch',
    update_frequency INTEGER DEFAULT 3600,
    authentication JSONB,
    rate_limits JSONB,
    transformation_rules JSONB DEFAULT '[]',
    schema_definition JSONB,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'disconnected',
    error_count INTEGER DEFAULT 0,
    data_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_type CHECK (type IN ('crm', 'marketing', 'social', 'news', 'regulatory', 'financial', 'api', 'websocket', 'database')),
    CONSTRAINT valid_category CHECK (category IN ('customer-data', 'lead-intelligence', 'market-signals', 'revenue-data', 'behavioral-data')),
    CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT valid_sync_strategy CHECK (sync_strategy IN ('real-time', 'batch', 'hybrid')),
    CONSTRAINT valid_sync_status CHECK (sync_status IN ('disconnected', 'connecting', 'connected', 'syncing', 'error'))
);

-- Data synchronization jobs and history
CREATE TABLE integrations.sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID NOT NULL REFERENCES integrations.data_sources(id) ON DELETE CASCADE,
    job_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    records_processed INTEGER DEFAULT 0,
    records_succeeded INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    CONSTRAINT valid_job_type CHECK (job_type IN ('full', 'incremental', 'retry')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Unified data store for integrated data
CREATE TABLE integrations.unified_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES integrations.data_sources(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    source_record_id VARCHAR(255),
    data JSONB NOT NULL,
    quality_score DECIMAL(3,2) DEFAULT 0.8,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, source_id, entity_type, entity_id)
);

-- API rate limiting and usage tracking
CREATE TABLE integrations.api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID NOT NULL REFERENCES integrations.data_sources(id) ON DELETE CASCADE,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- ANALYTICS SCHEMA: Business intelligence and metrics
-- ==================================================

-- KPI definitions and configurations
CREATE TABLE analytics.kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    calculation_method TEXT NOT NULL,
    target_value DECIMAL(15,4),
    threshold_warning DECIMAL(15,4),
    threshold_critical DECIMAL(15,4),
    unit VARCHAR(50),
    frequency VARCHAR(20) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN ('revenue', 'conversion', 'engagement', 'retention', 'churn', 'satisfaction')),
    CONSTRAINT valid_frequency CHECK (frequency IN ('real-time', 'hourly', 'daily', 'weekly', 'monthly'))
);

-- Time-series metric values
CREATE TABLE analytics.metric_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID NOT NULL REFERENCES analytics.kpis(id) ON DELETE CASCADE,
    client_id UUID REFERENCES core.clients(id) ON DELETE CASCADE,
    value DECIMAL(15,4) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predictive models and forecasts
CREATE TABLE analytics.predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    prediction_type VARCHAR(100) NOT NULL,
    target_entity_type VARCHAR(50),
    target_entity_id UUID,
    prediction_value DECIMAL(15,4),
    confidence_score DECIMAL(3,2),
    prediction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE,
    features JSONB,
    actual_value DECIMAL(15,4),
    accuracy_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_prediction_type CHECK (prediction_type IN ('churn', 'revenue', 'conversion', 'lifetime_value', 'engagement'))
);

-- ==================================================
-- AUDIT SCHEMA: Compliance and activity tracking
-- ==================================================

-- Audit log for all system activities
CREATE TABLE audit.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id),
    entity_type VARCHAR(100),
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'execute'))
);

-- Human-in-the-loop review requests and approvals
CREATE TABLE audit.hitl_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    swarm_id UUID REFERENCES swarm.swarm_configurations(id),
    decision_id UUID REFERENCES swarm.decisions(id),
    review_type VARCHAR(50) NOT NULL,
    context JSONB NOT NULL,
    requested_by VARCHAR(100),
    assigned_to UUID REFERENCES core.users(id),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    response JSONB,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_review_type CHECK (review_type IN ('approval', 'review', 'input', 'decision', 'escalation')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'completed', 'cancelled'))
);

-- Data governance and compliance tracking
CREATE TABLE audit.data_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_table VARCHAR(100) NOT NULL,
    source_column VARCHAR(100),
    source_record_id UUID,
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100),
    target_record_id UUID,
    transformation_applied TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processor VARCHAR(100),
    
    INDEX idx_lineage_source (source_table, source_record_id),
    INDEX idx_lineage_target (target_table, target_record_id)
);

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Core schema indexes
CREATE INDEX idx_users_organization_id ON core.users(organization_id);
CREATE INDEX idx_users_email_active ON core.users(email) WHERE is_active = true;
CREATE INDEX idx_clients_organization_id ON core.clients(organization_id);
CREATE INDEX idx_clients_health_score ON core.clients(health_score);
CREATE INDEX idx_clients_contract_end ON core.clients(contract_end_date) WHERE contract_end_date IS NOT NULL;
CREATE INDEX idx_contacts_client_id ON core.contacts(client_id);
CREATE INDEX idx_contacts_email ON core.contacts(email);
CREATE INDEX idx_opportunities_client_id ON core.opportunities(client_id);
CREATE INDEX idx_opportunities_stage_value ON core.opportunities(stage, value_usd);
CREATE INDEX idx_opportunities_close_date ON core.opportunities(close_date) WHERE close_date IS NOT NULL;

-- Swarm schema indexes
CREATE INDEX idx_agents_swarm_id ON swarm.agents(swarm_id);
CREATE INDEX idx_agents_type_status ON swarm.agents(type, status);
CREATE INDEX idx_decisions_swarm_id ON swarm.decisions(swarm_id);
CREATE INDEX idx_decisions_type_created ON swarm.decisions(decision_type, created_at);
CREATE INDEX idx_decisions_human_approval ON swarm.decisions(requires_human_approval, human_approved);
CREATE INDEX idx_agent_votes_decision_id ON swarm.agent_votes(decision_id);
CREATE INDEX idx_memory_entries_swarm_id ON swarm.memory_entries(swarm_id);
CREATE INDEX idx_memory_entries_type_relevance ON swarm.memory_entries(entry_type, relevance);
CREATE INDEX idx_memory_entries_tags ON swarm.memory_entries USING GIN(tags);
CREATE INDEX idx_neural_patterns_swarm_id ON swarm.neural_patterns(swarm_id);
CREATE INDEX idx_neural_patterns_type_success ON swarm.neural_patterns(pattern_type, success_rate);

-- Integrations schema indexes
CREATE INDEX idx_data_sources_organization_id ON integrations.data_sources(organization_id);
CREATE INDEX idx_data_sources_type_active ON integrations.data_sources(type, is_active);
CREATE INDEX idx_sync_jobs_data_source_id ON integrations.sync_jobs(data_source_id);
CREATE INDEX idx_sync_jobs_status_started ON integrations.sync_jobs(status, started_at);
CREATE INDEX idx_unified_data_organization_id ON integrations.unified_data(organization_id);
CREATE INDEX idx_unified_data_source_entity ON integrations.unified_data(source_id, entity_type, entity_id);
CREATE INDEX idx_unified_data_json ON integrations.unified_data USING GIN(data);
CREATE INDEX idx_api_usage_source_window ON integrations.api_usage(data_source_id, window_start, window_end);

-- Analytics schema indexes
CREATE INDEX idx_kpis_organization_id ON analytics.kpis(organization_id);
CREATE INDEX idx_kpis_type_active ON analytics.kpis(metric_type, is_active);
CREATE INDEX idx_metric_values_kpi_id ON analytics.metric_values(kpi_id);
CREATE INDEX idx_metric_values_client_calculated ON analytics.metric_values(client_id, calculated_at);
CREATE INDEX idx_metric_values_period ON analytics.metric_values(period_start, period_end);
CREATE INDEX idx_predictions_organization_id ON analytics.predictions(organization_id);
CREATE INDEX idx_predictions_type_entity ON analytics.predictions(prediction_type, target_entity_type, target_entity_id);
CREATE INDEX idx_predictions_date_confidence ON analytics.predictions(prediction_date, confidence_score);

-- Audit schema indexes
CREATE INDEX idx_activity_logs_organization_id ON audit.activity_logs(organization_id);
CREATE INDEX idx_activity_logs_user_created ON audit.activity_logs(user_id, created_at);
CREATE INDEX idx_activity_logs_entity ON audit.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_action_created ON audit.activity_logs(action, created_at);
CREATE INDEX idx_hitl_reviews_organization_id ON audit.hitl_reviews(organization_id);
CREATE INDEX idx_hitl_reviews_status_priority ON audit.hitl_reviews(status, priority);
CREATE INDEX idx_hitl_reviews_assigned_requested ON audit.hitl_reviews(assigned_to, requested_at);
CREATE INDEX idx_hitl_reviews_swarm_decision ON audit.hitl_reviews(swarm_id, decision_id);

-- ==================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ==================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON core.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON core.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON core.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swarm_configurations_updated_at BEFORE UPDATE ON swarm.swarm_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON swarm.agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON integrations.data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpis_updated_at BEFORE UPDATE ON analytics.kpis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Client health score calculation trigger
CREATE OR REPLACE FUNCTION calculate_client_health_score()
RETURNS TRIGGER AS $$
DECLARE
    engagement_score DECIMAL(3,2);
    revenue_score DECIMAL(3,2);
    support_score DECIMAL(3,2);
    final_score DECIMAL(3,2);
BEGIN
    -- Calculate engagement score from contacts
    SELECT COALESCE(AVG(engagement_score), 0.5) INTO engagement_score
    FROM core.contacts 
    WHERE client_id = NEW.id AND engagement_score IS NOT NULL;
    
    -- Calculate revenue score from opportunities
    SELECT CASE 
        WHEN COUNT(*) = 0 THEN 0.5
        WHEN AVG(probability) > 0.7 THEN 0.9
        WHEN AVG(probability) > 0.5 THEN 0.7
        WHEN AVG(probability) > 0.3 THEN 0.5
        ELSE 0.3
    END INTO revenue_score
    FROM core.opportunities 
    WHERE client_id = NEW.id AND stage NOT IN ('won', 'lost');
    
    -- Default support score (would be calculated from support tickets in production)
    support_score := 0.7;
    
    -- Calculate weighted final score
    final_score := (engagement_score * 0.4) + (revenue_score * 0.4) + (support_score * 0.2);
    
    NEW.health_score := LEAST(1.0, GREATEST(0.0, final_score));
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_health_score BEFORE INSERT OR UPDATE ON core.clients FOR EACH ROW EXECUTE FUNCTION calculate_client_health_score();

-- ==================================================
-- VIEWS FOR COMMON QUERIES
-- ==================================================

-- Client overview with latest metrics
CREATE VIEW analytics.client_overview AS
SELECT 
    c.id,
    c.name,
    c.industry,
    c.tier,
    c.health_score,
    c.risk_level,
    c.contract_end_date,
    COUNT(DISTINCT co.id) as contact_count,
    COUNT(DISTINCT o.id) as opportunity_count,
    SUM(CASE WHEN o.stage = 'won' THEN o.value_usd ELSE 0 END) as won_revenue,
    SUM(CASE WHEN o.stage NOT IN ('won', 'lost') THEN o.value_usd ELSE 0 END) as pipeline_value,
    AVG(co.engagement_score) as avg_engagement_score
FROM core.clients c
LEFT JOIN core.contacts co ON c.id = co.client_id
LEFT JOIN core.opportunities o ON c.id = o.client_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.industry, c.tier, c.health_score, c.risk_level, c.contract_end_date;

-- Swarm decision summary
CREATE VIEW swarm.decision_summary AS
SELECT 
    d.id,
    d.decision_type,
    d.confidence_score,
    d.participation_rate,
    d.requires_human_approval,
    d.human_approved,
    d.executed_at,
    d.created_at,
    sc.name as swarm_name,
    COUNT(av.id) as vote_count,
    AVG(av.confidence) as avg_agent_confidence
FROM swarm.decisions d
JOIN swarm.swarm_configurations sc ON d.swarm_id = sc.id
LEFT JOIN swarm.agent_votes av ON d.id = av.decision_id
GROUP BY d.id, d.decision_type, d.confidence_score, d.participation_rate, 
         d.requires_human_approval, d.human_approved, d.executed_at, d.created_at, sc.name;

-- Integration health dashboard
CREATE VIEW integrations.integration_health AS
SELECT 
    ds.id,
    ds.name,
    ds.type,
    ds.sync_status,
    ds.last_sync_at,
    ds.error_count,
    ds.data_count,
    CASE 
        WHEN ds.sync_status = 'connected' AND ds.last_sync_at > NOW() - INTERVAL '1 hour' THEN 'healthy'
        WHEN ds.sync_status = 'connected' AND ds.last_sync_at > NOW() - INTERVAL '24 hours' THEN 'warning'
        WHEN ds.sync_status = 'error' OR ds.error_count > 5 THEN 'critical'
        ELSE 'degraded'
    END as health_status,
    COUNT(sj.id) as recent_jobs_count,
    AVG(sj.duration_ms) as avg_sync_duration
FROM integrations.data_sources ds
LEFT JOIN integrations.sync_jobs sj ON ds.id = sj.data_source_id 
    AND sj.started_at > NOW() - INTERVAL '24 hours'
WHERE ds.is_active = true
GROUP BY ds.id, ds.name, ds.type, ds.sync_status, ds.last_sync_at, ds.error_count, ds.data_count;

-- HITL review queue
CREATE VIEW audit.review_queue AS
SELECT 
    hr.id,
    hr.review_type,
    hr.priority,
    hr.status,
    hr.requested_at,
    hr.assigned_to,
    u.first_name || ' ' || u.last_name as assigned_to_name,
    d.decision_type,
    d.confidence_score,
    sc.name as swarm_name,
    EXTRACT(EPOCH FROM (NOW() - hr.requested_at))/3600 as hours_pending
FROM audit.hitl_reviews hr
LEFT JOIN core.users u ON hr.assigned_to = u.id
LEFT JOIN swarm.decisions d ON hr.decision_id = d.id
LEFT JOIN swarm.swarm_configurations sc ON hr.swarm_id = sc.id
WHERE hr.status IN ('pending', 'in_review')
ORDER BY 
    CASE hr.priority 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    hr.requested_at ASC;

-- ==================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ==================================================

-- Get client risk assessment
CREATE OR REPLACE FUNCTION analytics.get_client_risk_assessment(client_uuid UUID)
RETURNS TABLE(
    client_id UUID,
    client_name VARCHAR(255),
    risk_level VARCHAR(20),
    health_score DECIMAL(3,2),
    contract_days_remaining INTEGER,
    engagement_trend VARCHAR(20),
    revenue_at_risk BIGINT,
    recommended_actions TEXT[]
) AS $$
DECLARE
    contract_end DATE;
    current_health DECIMAL(3,2);
    prev_health DECIMAL(3,2);
    trend VARCHAR(20);
    at_risk_revenue BIGINT;
    actions TEXT[];
BEGIN
    -- Get current client data
    SELECT c.contract_end_date, c.health_score INTO contract_end, current_health
    FROM core.clients c WHERE c.id = client_uuid;
    
    -- Calculate previous health score (simplified - would use historical data)
    prev_health := current_health + (random() * 0.2 - 0.1); -- Placeholder logic
    
    -- Determine engagement trend
    IF current_health > prev_health + 0.1 THEN
        trend := 'improving';
    ELSIF current_health < prev_health - 0.1 THEN
        trend := 'declining';
    ELSE
        trend := 'stable';
    END IF;
    
    -- Calculate revenue at risk
    SELECT COALESCE(SUM(o.value_usd), 0) INTO at_risk_revenue
    FROM core.opportunities o 
    WHERE o.client_id = client_uuid AND o.stage NOT IN ('won', 'lost');
    
    -- Generate recommended actions
    actions := ARRAY[]::TEXT[];
    IF current_health < 0.3 THEN
        actions := array_append(actions, 'Immediate executive intervention required');
        actions := array_append(actions, 'Schedule emergency client health review');
    ELSIF current_health < 0.5 THEN
        actions := array_append(actions, 'Increase engagement touchpoints');
        actions := array_append(actions, 'Review and address pain points');
    ELSIF trend = 'declining' THEN
        actions := array_append(actions, 'Monitor engagement metrics closely');
        actions := array_append(actions, 'Proactive outreach recommended');
    END IF;
    
    IF contract_end IS NOT NULL AND contract_end - CURRENT_DATE < 90 THEN
        actions := array_append(actions, 'Contract renewal process should begin');
    END IF;
    
    RETURN QUERY SELECT 
        client_uuid,
        (SELECT name FROM core.clients WHERE id = client_uuid),
        (SELECT core.clients.risk_level FROM core.clients WHERE id = client_uuid),
        current_health,
        CASE WHEN contract_end IS NOT NULL THEN (contract_end - CURRENT_DATE)::INTEGER ELSE NULL END,
        trend,
        at_risk_revenue,
        actions;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA core TO application_user;
GRANT USAGE ON SCHEMA swarm TO application_user;
GRANT USAGE ON SCHEMA integrations TO application_user;
GRANT USAGE ON SCHEMA analytics TO application_user;
GRANT USAGE ON SCHEMA audit TO application_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO application_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA swarm TO application_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA integrations TO application_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO application_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA audit TO application_user;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA core TO application_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA swarm TO application_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA integrations TO application_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA analytics TO application_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA audit TO application_user;

-- Create read-only user for analytics
GRANT USAGE ON SCHEMA core TO analytics_reader;
GRANT USAGE ON SCHEMA analytics TO analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO analytics_reader;