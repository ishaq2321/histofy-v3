/**
 * Histofy v3 - Workflow Automation System
 * Conditional logic and multi-step process automation
 */

const { EventEmitter } = require('events');
const { SecurityUtils } = require('../security/SecurityUtils');
const { AuditLogger } = require('../utils/AuditLogger');
const { GitManager } = require('../core/GitManager');
const { ConfigManager } = require('../config/ConfigManager');

class WorkflowEngine extends EventEmitter {
    constructor() {
        super();
        this.workflows = new Map();
        this.executions = new Map();
        this.auditLogger = new AuditLogger();
        this.gitManager = new GitManager();
        this.configManager = new ConfigManager();
        
        // Built-in actions
        this.actions = new Map([
            ['git.commit', this.actionGitCommit.bind(this)],
            ['git.push', this.actionGitPush.bind(this)],
            ['config.set', this.actionConfigSet.bind(this)],
            ['config.get', this.actionConfigGet.bind(this)],
            ['webhook.trigger', this.actionWebhookTrigger.bind(this)],
            ['delay', this.actionDelay.bind(this)],
            ['log', this.actionLog.bind(this)],
            ['condition', this.actionCondition.bind(this)],
            ['loop', this.actionLoop.bind(this)],
            ['parallel', this.actionParallel.bind(this)]
        ]);
        
        // Built-in conditions
        this.conditions = new Map([
            ['equals', this.conditionEquals.bind(this)],
            ['not_equals', this.conditionNotEquals.bind(this)],
            ['contains', this.conditionContains.bind(this)],
            ['regex', this.conditionRegex.bind(this)],
            ['exists', this.conditionExists.bind(this)],
            ['git.has_changes', this.conditionGitHasChanges.bind(this)],
            ['git.branch_exists', this.conditionGitBranchExists.bind(this)],
            ['config.has_key', this.conditionConfigHasKey.bind(this)]
        ]);
    }
    
    /**
     * Define a new workflow
     */
    defineWorkflow(id, definition) {
        // Validate workflow definition
        this.validateWorkflowDefinition(definition);
        
        const workflow = {
            id,
            name: definition.name || id,
            description: definition.description || '',
            version: definition.version || '1.0.0',
            triggers: definition.triggers || [],
            steps: definition.steps || [],
            variables: definition.variables || {},
            timeout: definition.timeout || 300000, // 5 minutes
            retryPolicy: definition.retryPolicy || { attempts: 3, delay: 1000 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            enabled: definition.enabled !== false
        };
        
        this.workflows.set(id, workflow);
        
        // Log workflow definition
        this.auditLogger.logOperation('workflow_defined', {
            workflowId: id,
            name: workflow.name,
            stepCount: workflow.steps.length,
            triggerCount: workflow.triggers.length
        });
        
        return workflow;
    }
    
    /**
     * Validate workflow definition
     */
    validateWorkflowDefinition(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new Error('Workflow definition must be an object');
        }
        
        if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
            throw new Error('Workflow must have at least one step');
        }
        
        // Validate each step
        for (let i = 0; i < definition.steps.length; i++) {
            const step = definition.steps[i];
            
            if (!step.action) {
                throw new Error(`Step ${i + 1} must have an action`);
            }
            
            if (!this.actions.has(step.action)) {
                throw new Error(`Unknown action: ${step.action}`);
            }
            
            // Validate conditions if present
            if (step.condition) {
                this.validateCondition(step.condition);
            }
        }
        
        // Validate triggers
        if (definition.triggers) {
            for (const trigger of definition.triggers) {
                if (!trigger.event) {
                    throw new Error('Trigger must have an event');
                }
            }
        }
    }
    
    /**
     * Validate condition definition
     */
    validateCondition(condition) {
        if (!condition.type) {
            throw new Error('Condition must have a type');
        }
        
        if (!this.conditions.has(condition.type)) {
            throw new Error(`Unknown condition type: ${condition.type}`);
        }
    }
    
    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId, context = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        
        if (!workflow.enabled) {
            throw new Error(`Workflow is disabled: ${workflowId}`);
        }
        
        const executionId = this.generateExecutionId();
        const execution = {
            id: executionId,
            workflowId,
            status: 'running',
            startTime: new Date().toISOString(),
            endTime: null,
            context: { ...workflow.variables, ...context },
            steps: [],
            error: null,
            result: null
        };
        
        this.executions.set(executionId, execution);
        
        try {
            // Log workflow start
            this.auditLogger.logOperation('workflow_started', {
                workflowId,
                executionId,
                context: Object.keys(context)
            });
            
            // Execute workflow with timeout
            const result = await Promise.race([
                this.executeSteps(workflow, execution),
                this.createTimeoutPromise(workflow.timeout)
            ]);
            
            execution.status = 'completed';
            execution.endTime = new Date().toISOString();
            execution.result = result;
            
            // Log workflow completion
            this.auditLogger.logOperation('workflow_completed', {
                workflowId,
                executionId,
                duration: Date.parse(execution.endTime) - Date.parse(execution.startTime),
                stepCount: execution.steps.length
            });
            
            this.emit('workflow.completed', { workflowId, executionId, result });
            
            return execution;
        } catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date().toISOString();
            execution.error = error.message;
            
            // Log workflow failure
            this.auditLogger.logOperation('workflow_failed', {
                workflowId,
                executionId,
                error: error.message,
                stepCount: execution.steps.length
            });
            
            this.emit('workflow.failed', { workflowId, executionId, error });
            
            throw error;
        } finally {
            this.executions.set(executionId, execution);
        }
    }
    
    /**
     * Execute workflow steps
     */
    async executeSteps(workflow, execution) {
        let result = null;
        
        for (let i = 0; i < workflow.steps.length; i++) {
            const step = workflow.steps[i];
            const stepExecution = {
                index: i,
                name: step.name || `Step ${i + 1}`,
                action: step.action,
                status: 'running',
                startTime: new Date().toISOString(),
                endTime: null,
                input: step.input || {},
                output: null,
                error: null
            };
            
            execution.steps.push(stepExecution);
            
            try {
                // Check condition if present
                if (step.condition) {
                    const conditionResult = await this.evaluateCondition(step.condition, execution.context);
                    if (!conditionResult) {
                        stepExecution.status = 'skipped';
                        stepExecution.endTime = new Date().toISOString();
                        continue;
                    }
                }
                
                // Execute action
                const actionHandler = this.actions.get(step.action);
                const input = this.resolveVariables(step.input || {}, execution.context);
                
                const output = await actionHandler(input, execution.context);
                
                stepExecution.status = 'completed';
                stepExecution.endTime = new Date().toISOString();
                stepExecution.output = output;
                
                // Update context with step output
                if (step.outputVariable) {
                    execution.context[step.outputVariable] = output;
                }
                
                result = output;
                
            } catch (error) {
                stepExecution.status = 'failed';
                stepExecution.endTime = new Date().toISOString();
                stepExecution.error = error.message;
                
                // Handle step failure based on error policy
                if (step.continueOnError) {
                    continue;
                } else {
                    throw error;
                }
            }
        }
        
        return result;
    }
    
    /**
     * Evaluate condition
     */
    async evaluateCondition(condition, context) {
        const conditionHandler = this.conditions.get(condition.type);
        if (!conditionHandler) {
            throw new Error(`Unknown condition type: ${condition.type}`);
        }
        
        const input = this.resolveVariables(condition.input || {}, context);
        return await conditionHandler(input, context);
    }
    
    /**
     * Resolve variables in input
     */
    resolveVariables(input, context) {
        if (typeof input === 'string') {
            return input.replace(/\$\{([^}]+)\}/g, (match, variable) => {
                return context[variable] || match;
            });
        } else if (Array.isArray(input)) {
            return input.map(item => this.resolveVariables(item, context));
        } else if (typeof input === 'object' && input !== null) {
            const resolved = {};
            for (const [key, value] of Object.entries(input)) {
                resolved[key] = this.resolveVariables(value, context);
            }
            return resolved;
        }
        
        return input;
    }
    
    /**
     * Create timeout promise
     */
    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Workflow execution timeout after ${timeout}ms`));
            }, timeout);
        });
    }
    
    /**
     * Generate execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Built-in Actions
    
    async actionGitCommit(input, context) {
        SecurityUtils.validateCommitMessage(input.message);
        
        const result = await this.gitManager.createCommit({
            message: input.message,
            date: input.date,
            author: input.author,
            addAll: input.addAll || false
        });
        
        return result;
    }
    
    async actionGitPush(input, context) {
        const result = await this.gitManager.pushChanges({
            remote: input.remote || 'origin',
            branch: input.branch
        });
        
        return result;
    }
    
    async actionConfigSet(input, context) {
        SecurityUtils.validateConfigKey(input.key);
        await this.configManager.set(input.key, input.value);
        return { key: input.key, value: input.value };
    }
    
    async actionConfigGet(input, context) {
        SecurityUtils.validateConfigKey(input.key);
        const value = await this.configManager.get(input.key);
        return { key: input.key, value };
    }
    
    async actionWebhookTrigger(input, context) {
        // This would integrate with the webhook system
        this.emit('webhook.trigger', {
            event: input.event,
            payload: input.payload || {}
        });
        
        return { event: input.event, triggered: true };
    }
    
    async actionDelay(input, context) {
        const delay = input.milliseconds || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { delayed: delay };
    }
    
    async actionLog(input, context) {
        const message = input.message || 'Workflow log';
        const level = input.level || 'info';
        
        console.log(`[${level.toUpperCase()}] ${message}`);
        
        return { message, level };
    }
    
    async actionCondition(input, context) {
        const result = await this.evaluateCondition(input.condition, context);
        
        if (result && input.then) {
            return await this.executeAction(input.then, context);
        } else if (!result && input.else) {
            return await this.executeAction(input.else, context);
        }
        
        return { condition: result };
    }
    
    async actionLoop(input, context) {
        const items = input.items || [];
        const results = [];
        
        for (const item of items) {
            const itemContext = { ...context, item };
            const result = await this.executeAction(input.action, itemContext);
            results.push(result);
        }
        
        return { results };
    }
    
    async actionParallel(input, context) {
        const actions = input.actions || [];
        const results = await Promise.allSettled(
            actions.map(action => this.executeAction(action, context))
        );
        
        return {
            results: results.map(r => ({
                status: r.status,
                value: r.value,
                reason: r.reason?.message
            }))
        };
    }
    
    async executeAction(action, context) {
        const actionHandler = this.actions.get(action.type);
        if (!actionHandler) {
            throw new Error(`Unknown action type: ${action.type}`);
        }
        
        const input = this.resolveVariables(action.input || {}, context);
        return await actionHandler(input, context);
    }
    
    // Built-in Conditions
    
    async conditionEquals(input, context) {
        return input.left === input.right;
    }
    
    async conditionNotEquals(input, context) {
        return input.left !== input.right;
    }
    
    async conditionContains(input, context) {
        const haystack = String(input.haystack || '');
        const needle = String(input.needle || '');
        return haystack.includes(needle);
    }
    
    async conditionRegex(input, context) {
        const pattern = new RegExp(input.pattern, input.flags || '');
        const text = String(input.text || '');
        return pattern.test(text);
    }
    
    async conditionExists(input, context) {
        return input.value !== undefined && input.value !== null;
    }
    
    async conditionGitHasChanges(input, context) {
        const status = await this.gitManager.getRepositoryStatus();
        return status.hasChanges;
    }
    
    async conditionGitBranchExists(input, context) {
        try {
            await this.gitManager.getBranchInfo(input.branch);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async conditionConfigHasKey(input, context) {
        try {
            const value = await this.configManager.get(input.key);
            return value !== undefined;
        } catch (error) {
            return false;
        }
    }
    
    // Workflow Management
    
    /**
     * Get workflow definition
     */
    getWorkflow(id) {
        return this.workflows.get(id);
    }
    
    /**
     * List all workflows
     */
    listWorkflows() {
        return Array.from(this.workflows.values());
    }
    
    /**
     * Delete workflow
     */
    deleteWorkflow(id) {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error(`Workflow not found: ${id}`);
        }
        
        this.workflows.delete(id);
        
        this.auditLogger.logOperation('workflow_deleted', {
            workflowId: id,
            name: workflow.name
        });
        
        return true;
    }
    
    /**
     * Get workflow execution
     */
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    
    /**
     * List workflow executions
     */
    listExecutions(workflowId = null) {
        const executions = Array.from(this.executions.values());
        
        if (workflowId) {
            return executions.filter(exec => exec.workflowId === workflowId);
        }
        
        return executions;
    }
    
    /**
     * Cancel workflow execution
     */
    cancelExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution not found: ${executionId}`);
        }
        
        if (execution.status === 'running') {
            execution.status = 'cancelled';
            execution.endTime = new Date().toISOString();
            execution.error = 'Execution cancelled by user';
            
            this.executions.set(executionId, execution);
            
            this.auditLogger.logOperation('workflow_cancelled', {
                workflowId: execution.workflowId,
                executionId
            });
            
            this.emit('workflow.cancelled', { executionId });
        }
        
        return execution;
    }
}

module.exports = { WorkflowEngine };