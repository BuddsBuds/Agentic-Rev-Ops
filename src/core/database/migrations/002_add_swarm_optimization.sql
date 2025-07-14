-- Migration: Add Swarm Optimization Features
-- Version: 002
-- Description: Add performance optimization tracking and automated tuning capabilities

-- UP
-- Add optimization tracking table
CREATE TABLE IF NOT EXISTS swarm.optimization_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    optimization_type VARCHAR(50) NOT NULL,
    baseline_metrics JSONB NOT NULL,
    target_metrics JSONB NOT NULL,
    applied_changes JSONB NOT NULL,
    improvement_score DECIMAL(5,4),
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_optimization_type CHECK (optimization_type IN ('performance', 'accuracy', 'cost', 'hybrid')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'reverted'))
);

-- Add indexes for optimization tracking
CREATE INDEX idx_optimization_runs_swarm_id ON swarm.optimization_runs(swarm_id);
CREATE INDEX idx_optimization_runs_status ON swarm.optimization_runs(status);
CREATE INDEX idx_optimization_runs_started_at ON swarm.optimization_runs(started_at);

-- Add performance benchmarks table
CREATE TABLE IF NOT EXISTS swarm.performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarm.swarm_configurations(id) ON DELETE CASCADE,
    benchmark_type VARCHAR(50) NOT NULL,
    test_parameters JSONB NOT NULL,
    results JSONB NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    memory_usage_mb INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_benchmark_type CHECK (benchmark_type IN ('decision_speed', 'accuracy', 'scalability', 'resource_usage'))
);

-- Add indexes for benchmarks
CREATE INDEX idx_performance_benchmarks_swarm_id ON swarm.performance_benchmarks(swarm_id);
CREATE INDEX idx_performance_benchmarks_type ON swarm.performance_benchmarks(benchmark_type);
CREATE INDEX idx_performance_benchmarks_created_at ON swarm.performance_benchmarks(created_at);

-- Add optimization recommendations view
CREATE VIEW swarm.optimization_recommendations AS
SELECT 
    sc.id as swarm_id,
    sc.name as swarm_name,
    sc.topology,
    COUNT(d.id) as total_decisions,
    AVG(d.confidence_score) as avg_confidence,
    AVG(EXTRACT(EPOCH FROM (d.executed_at - d.created_at)) * 1000) as avg_response_time,
    COUNT(CASE WHEN d.executed_at IS NULL THEN 1 END) as failed_decisions,
    CASE 
        WHEN AVG(d.confidence_score) < 0.6 THEN 'increase_voting_threshold'
        WHEN AVG(EXTRACT(EPOCH FROM (d.executed_at - d.created_at)) * 1000) > 10000 THEN 'optimize_agent_count'
        WHEN COUNT(CASE WHEN d.executed_at IS NULL THEN 1 END) > COUNT(d.id) * 0.1 THEN 'review_agent_performance'
        ELSE 'no_optimization_needed'
    END as recommendation,
    CURRENT_TIMESTAMP as analyzed_at
FROM swarm.swarm_configurations sc
LEFT JOIN swarm.decisions d ON sc.id = d.swarm_id 
    AND d.created_at > NOW() - INTERVAL '30 days'
WHERE sc.is_active = true AND sc.deleted_at IS NULL
GROUP BY sc.id, sc.name, sc.topology;

-- Add function to calculate swarm efficiency score
CREATE OR REPLACE FUNCTION swarm.calculate_efficiency_score(swarm_uuid UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    decision_score DECIMAL(3,2) := 0.5;
    response_score DECIMAL(3,2) := 0.5;
    accuracy_score DECIMAL(3,2) := 0.5;
    efficiency_score DECIMAL(3,2);
BEGIN
    -- Calculate decision throughput score
    SELECT 
        LEAST(1.0, COUNT(*)::decimal / 100) INTO decision_score
    FROM swarm.decisions 
    WHERE swarm_id = swarm_uuid 
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Calculate response time score
    SELECT 
        GREATEST(0.0, 1.0 - (AVG(EXTRACT(EPOCH FROM (executed_at - created_at))) / 300)) INTO response_score
    FROM swarm.decisions 
    WHERE swarm_id = swarm_uuid 
    AND executed_at IS NOT NULL
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Calculate accuracy score
    SELECT 
        AVG(confidence_score) INTO accuracy_score
    FROM swarm.decisions 
    WHERE swarm_id = swarm_uuid 
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Weighted efficiency score
    efficiency_score := (decision_score * 0.3 + response_score * 0.4 + accuracy_score * 0.3);
    
    RETURN LEAST(1.0, GREATEST(0.0, efficiency_score));
END;
$$ LANGUAGE plpgsql;

-- Add auto-optimization trigger
CREATE OR REPLACE FUNCTION swarm.trigger_auto_optimization()
RETURNS trigger AS $$
DECLARE
    efficiency_score DECIMAL(3,2);
    swarm_config RECORD;
BEGIN
    -- Calculate efficiency for the swarm
    efficiency_score := swarm.calculate_efficiency_score(NEW.swarm_id);
    
    -- If efficiency is below threshold, queue optimization
    IF efficiency_score < 0.6 THEN
        -- Get swarm configuration
        SELECT * INTO swarm_config 
        FROM swarm.swarm_configurations 
        WHERE id = NEW.swarm_id;
        
        -- Only auto-optimize if enabled in configuration
        IF (swarm_config.configuration->>'auto_optimization_enabled')::boolean = true THEN
            INSERT INTO swarm.optimization_runs (
                swarm_id, 
                optimization_type, 
                baseline_metrics, 
                target_metrics,
                applied_changes,
                status
            ) VALUES (
                NEW.swarm_id,
                'performance',
                jsonb_build_object('efficiency_score', efficiency_score),
                jsonb_build_object('target_efficiency', 0.8),
                jsonb_build_object('triggered_by', 'auto_optimization'),
                'pending'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-optimization
CREATE TRIGGER trigger_swarm_auto_optimization
    AFTER INSERT ON swarm.decisions
    FOR EACH ROW
    EXECUTE FUNCTION swarm.trigger_auto_optimization();

-- DOWN
DROP TRIGGER IF EXISTS trigger_swarm_auto_optimization ON swarm.decisions;
DROP FUNCTION IF EXISTS swarm.trigger_auto_optimization();
DROP FUNCTION IF EXISTS swarm.calculate_efficiency_score(UUID);
DROP VIEW IF EXISTS swarm.optimization_recommendations;
DROP TABLE IF EXISTS swarm.performance_benchmarks;
DROP TABLE IF EXISTS swarm.optimization_runs;