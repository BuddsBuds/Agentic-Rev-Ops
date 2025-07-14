// Workflow Engine Interfaces
export interface WorkflowExecution {
  workflowId: string;
  context: any;
  priority: number;
  scheduledTime?: Date;
}

export interface StepExecutor {
  execute(step: WorkflowStep, context: any, workflow: Workflow): Promise<any>;
  validate(step: WorkflowStep): string[];
}

import { WorkflowStep, Workflow } from './workflow-engine';