/**
 * Histofy v3 - Webhook System
 * Event-driven automation support
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const { SecurityUtils } = require('../security/SecurityUtils');
const { AuditLogger } = require('../utils/AuditLogger');

class WebhookManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.webhooks = new Map();
        this.auditLogger = new AuditLogger();
        this.secretKey = options.secretKey || this.generateSecret();
        this.timeout = options.timeout || 30000; // 30 seconds
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
    }
    
    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Register a webhook endpoint
     */
    registerWebhook(id, config) {
        if (!config.url || !config.events) {
            throw new Error('Webhook URL and events are required');
        }
        
        // Validate URL
        SecurityUtils.validateUrl(config.url);
        
        // Validate events
        const validEvents = [
            'commit.created',
            'commit.modified',
            'migration.started',
            'migration.completed',
            'migration.failed',
            'config.changed',
            'batch.started',
            'batch.completed',
            'batch.failed',
            'audit.logged',
            'error.occurred'
        ];
        
        for (const event of config.events) {
            if (!validEvents.includes(event)) {
                throw new Error(`Invalid event: ${event}`);
            }
        }
        
        const webhook = {
            id,
            url: config.url,
            events: config.events,
            secret: config.secret || this.secretKey,
            active: config.active !== false,
            headers: config.headers || {},
            retryPolicy: config.retryPolicy || 'exponential',
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            successCount: 0,
            failureCount: 0
        };
        
        this.webhooks.set(id, webhook);
        
        // Log webhook registration
        this.auditLogger.logOperation('webhook_registered', {
            webhookId: id,
            url: config.url,
            events: config.events
        });
        
        return webhook;
    }
    
    /**
     * Unregister a webhook
     */
    unregisterWebhook(id) {
        const webhook = this.webhooks.get(id);
        if (!webhook) {
            throw new Error(`Webhook not found: ${id}`);
        }
        
        this.webhooks.delete(id);
        
        this.auditLogger.logOperation('webhook_unregistered', {
            webhookId: id,
            url: webhook.url
        });
        
        return true;
    }
    
    /**
     * Get webhook configuration
     */
    getWebhook(id) {
        return this.webhooks.get(id);
    }
    
    /**
     * List all webhooks
     */
    listWebhooks() {
        return Array.from(this.webhooks.values());
    }
    
    /**
     * Update webhook configuration
     */
    updateWebhook(id, updates) {
        const webhook = this.webhooks.get(id);
        if (!webhook) {
            throw new Error(`Webhook not found: ${id}`);
        }
        
        // Validate updates
        if (updates.url) {
            SecurityUtils.validateUrl(updates.url);
        }
        
        // Apply updates
        Object.assign(webhook, updates, {
            updatedAt: new Date().toISOString()
        });
        
        this.webhooks.set(id, webhook);
        
        this.auditLogger.logOperation('webhook_updated', {
            webhookId: id,
            updates: Object.keys(updates)
        });
        
        return webhook;
    }
    
    /**
     * Trigger webhooks for an event
     */
    async triggerEvent(eventType, payload) {
        const relevantWebhooks = Array.from(this.webhooks.values())
            .filter(webhook => webhook.active && webhook.events.includes(eventType));
        
        if (relevantWebhooks.length === 0) {
            return { triggered: 0, results: [] };
        }
        
        const results = await Promise.allSettled(
            relevantWebhooks.map(webhook => this.deliverWebhook(webhook, eventType, payload))
        );
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        
        // Log event trigger
        this.auditLogger.logOperation('webhook_event_triggered', {
            eventType,
            webhookCount: relevantWebhooks.length,
            successCount,
            failureCount
        });
        
        return {
            triggered: relevantWebhooks.length,
            successful: successCount,
            failed: failureCount,
            results: results.map((result, index) => ({
                webhookId: relevantWebhooks[index].id,
                status: result.status,
                value: result.value,
                reason: result.reason?.message
            }))
        };
    }
    
    /**
     * Deliver webhook to a specific endpoint
     */
    async deliverWebhook(webhook, eventType, payload) {
        const webhookPayload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload,
            webhook: {
                id: webhook.id,
                delivery_id: crypto.randomUUID()
            }
        };
        
        const signature = this.generateSignature(webhookPayload, webhook.secret);
        
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Histofy-Webhook/3.0.0',
            'X-Histofy-Event': eventType,
            'X-Histofy-Delivery': webhookPayload.webhook.delivery_id,
            'X-Histofy-Signature': signature,
            ...webhook.headers
        };
        
        let attempt = 0;
        let lastError;
        
        while (attempt < this.retryAttempts) {
            try {
                const result = await this.makeHttpRequest(webhook.url, webhookPayload, headers);
                
                // Update webhook statistics
                webhook.lastTriggered = new Date().toISOString();
                webhook.successCount++;
                this.webhooks.set(webhook.id, webhook);
                
                // Log successful delivery
                this.auditLogger.logOperation('webhook_delivered', {
                    webhookId: webhook.id,
                    eventType,
                    deliveryId: webhookPayload.webhook.delivery_id,
                    attempt: attempt + 1,
                    statusCode: result.statusCode
                });
                
                return result;
            } catch (error) {
                lastError = error;
                attempt++;
                
                if (attempt < this.retryAttempts) {
                    const delay = this.calculateRetryDelay(attempt, webhook.retryPolicy);
                    await this.sleep(delay);
                }
            }
        }
        
        // Update failure statistics
        webhook.failureCount++;
        this.webhooks.set(webhook.id, webhook);
        
        // Log failed delivery
        this.auditLogger.logOperation('webhook_delivery_failed', {
            webhookId: webhook.id,
            eventType,
            deliveryId: webhookPayload.webhook.delivery_id,
            attempts: this.retryAttempts,
            error: lastError.message
        });
        
        throw lastError;
    }
    
    /**
     * Generate webhook signature for verification
     */
    generateSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payloadString);
        return `sha256=${hmac.digest('hex')}`;
    }
    
    /**
     * Verify webhook signature
     */
    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }
    
    /**
     * Make HTTP request to webhook endpoint
     */
    async makeHttpRequest(url, payload, headers) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(JSON.stringify(payload))
                },
                timeout: this.timeout
            };
            
            const req = httpModule.request(options, (res) => {
                let responseBody = '';
                
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: responseBody
                        });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.write(JSON.stringify(payload));
            req.end();
        });
    }
    
    /**
     * Calculate retry delay based on policy
     */
    calculateRetryDelay(attempt, policy) {
        switch (policy) {
            case 'linear':
                return this.retryDelay * attempt;
            case 'exponential':
                return this.retryDelay * Math.pow(2, attempt - 1);
            case 'fixed':
            default:
                return this.retryDelay;
        }
    }
    
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Test webhook endpoint
     */
    async testWebhook(id) {
        const webhook = this.webhooks.get(id);
        if (!webhook) {
            throw new Error(`Webhook not found: ${id}`);
        }
        
        const testPayload = {
            test: true,
            message: 'This is a test webhook delivery from Histofy',
            timestamp: new Date().toISOString()
        };
        
        try {
            const result = await this.deliverWebhook(webhook, 'test.ping', testPayload);
            return {
                success: true,
                statusCode: result.statusCode,
                response: result.body
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get webhook statistics
     */
    getWebhookStats(id) {
        const webhook = this.webhooks.get(id);
        if (!webhook) {
            throw new Error(`Webhook not found: ${id}`);
        }
        
        return {
            id: webhook.id,
            url: webhook.url,
            active: webhook.active,
            createdAt: webhook.createdAt,
            lastTriggered: webhook.lastTriggered,
            successCount: webhook.successCount,
            failureCount: webhook.failureCount,
            successRate: webhook.successCount + webhook.failureCount > 0 
                ? (webhook.successCount / (webhook.successCount + webhook.failureCount)) * 100 
                : 0
        };
    }
    
    /**
     * Export webhook configuration
     */
    exportConfig() {
        const config = {};
        for (const [id, webhook] of this.webhooks) {
            config[id] = {
                url: webhook.url,
                events: webhook.events,
                active: webhook.active,
                headers: webhook.headers,
                retryPolicy: webhook.retryPolicy
            };
        }
        return config;
    }
    
    /**
     * Import webhook configuration
     */
    importConfig(config) {
        const imported = [];
        const errors = [];
        
        for (const [id, webhookConfig] of Object.entries(config)) {
            try {
                this.registerWebhook(id, webhookConfig);
                imported.push(id);
            } catch (error) {
                errors.push({ id, error: error.message });
            }
        }
        
        return { imported, errors };
    }
}

module.exports = { WebhookManager };