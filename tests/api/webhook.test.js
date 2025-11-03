/**
 * Tests for Webhook System
 */

const { WebhookManager } = require('../../src/api/webhook');
const http = require('http');

describe('WebhookManager', () => {
    let webhookManager;
    let mockServer;
    let mockServerUrl;
    
    beforeEach(() => {
        webhookManager = new WebhookManager();
        
        // Create mock webhook server
        mockServer = http.createServer((req, res) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                // Store the request for verification
                mockServer.lastRequest = {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: JSON.parse(body)
                };
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        });
        
        return new Promise((resolve) => {
            mockServer.listen(0, () => {
                const port = mockServer.address().port;
                mockServerUrl = `http://localhost:${port}`;
                resolve();
            });
        });
    });
    
    afterEach(() => {
        if (mockServer) {
            mockServer.close();
        }
    });
    
    describe('Webhook Registration', () => {
        test('should register webhook successfully', () => {
            const webhook = webhookManager.registerWebhook('test-webhook', {
                url: mockServerUrl,
                events: ['commit.created', 'migration.completed']
            });
            
            expect(webhook.id).toBe('test-webhook');
            expect(webhook.url).toBe(mockServerUrl);
            expect(webhook.events).toEqual(['commit.created', 'migration.completed']);
            expect(webhook.active).toBe(true);
        });
        
        test('should validate webhook configuration', () => {
            expect(() => {
                webhookManager.registerWebhook('invalid-webhook', {
                    // Missing URL and events
                });
            }).toThrow('Webhook URL and events are required');
        });
        
        test('should validate event types', () => {
            expect(() => {
                webhookManager.registerWebhook('invalid-events', {
                    url: mockServerUrl,
                    events: ['invalid.event']
                });
            }).toThrow('Invalid event: invalid.event');
        });
        
        test('should generate secret if not provided', () => {
            const webhook = webhookManager.registerWebhook('auto-secret', {
                url: mockServerUrl,
                events: ['commit.created']
            });
            
            expect(webhook.secret).toBeDefined();
            expect(webhook.secret.length).toBeGreaterThan(0);
        });
    });
    
    describe('Webhook Management', () => {
        beforeEach(() => {
            webhookManager.registerWebhook('test-webhook', {
                url: mockServerUrl,
                events: ['commit.created']
            });
        });
        
        test('should get webhook by ID', () => {
            const webhook = webhookManager.getWebhook('test-webhook');
            
            expect(webhook).toBeDefined();
            expect(webhook.id).toBe('test-webhook');
        });
        
        test('should list all webhooks', () => {
            webhookManager.registerWebhook('second-webhook', {
                url: mockServerUrl,
                events: ['migration.completed']
            });
            
            const webhooks = webhookManager.listWebhooks();
            
            expect(webhooks).toHaveLength(2);
            expect(webhooks.map(w => w.id)).toContain('test-webhook');
            expect(webhooks.map(w => w.id)).toContain('second-webhook');
        });
        
        test('should update webhook configuration', () => {
            const updatedWebhook = webhookManager.updateWebhook('test-webhook', {
                active: false,
                events: ['commit.created', 'commit.modified']
            });
            
            expect(updatedWebhook.active).toBe(false);
            expect(updatedWebhook.events).toEqual(['commit.created', 'commit.modified']);
            expect(updatedWebhook.updatedAt).toBeDefined();
        });
        
        test('should unregister webhook', () => {
            const result = webhookManager.unregisterWebhook('test-webhook');
            
            expect(result).toBe(true);
            expect(webhookManager.getWebhook('test-webhook')).toBeUndefined();
        });
        
        test('should throw error for non-existent webhook', () => {
            expect(() => {
                webhookManager.unregisterWebhook('non-existent');
            }).toThrow('Webhook not found: non-existent');
        });
    });
    
    describe('Event Triggering', () => {
        beforeEach(() => {
            webhookManager.registerWebhook('active-webhook', {
                url: mockServerUrl,
                events: ['commit.created', 'migration.completed']
            });
            
            webhookManager.registerWebhook('inactive-webhook', {
                url: mockServerUrl,
                events: ['commit.created'],
                active: false
            });
            
            webhookManager.registerWebhook('different-events', {
                url: mockServerUrl,
                events: ['config.changed']
            });
        });
        
        test('should trigger relevant webhooks for event', async () => {
            const result = await webhookManager.triggerEvent('commit.created', {
                message: 'Test commit',
                hash: 'abc123'
            });
            
            expect(result.triggered).toBe(1); // Only active webhook with matching event
            expect(result.successful).toBe(1);
            expect(result.failed).toBe(0);
        });
        
        test('should not trigger inactive webhooks', async () => {
            const result = await webhookManager.triggerEvent('commit.created', {
                message: 'Test commit'
            });
            
            // Should only trigger active webhook
            expect(result.triggered).toBe(1);
        });
        
        test('should not trigger webhooks for non-matching events', async () => {
            const result = await webhookManager.triggerEvent('audit.logged', {
                operation: 'test'
            });
            
            expect(result.triggered).toBe(0);
        });
        
        test('should include proper webhook payload', async () => {
            const payload = { message: 'Test commit', hash: 'abc123' };
            
            await webhookManager.triggerEvent('commit.created', payload);
            
            // Wait a bit for the request to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(mockServer.lastRequest).toBeDefined();
            expect(mockServer.lastRequest.method).toBe('POST');
            expect(mockServer.lastRequest.headers['content-type']).toBe('application/json');
            expect(mockServer.lastRequest.headers['x-histofy-event']).toBe('commit.created');
            expect(mockServer.lastRequest.headers['x-histofy-signature']).toBeDefined();
            expect(mockServer.lastRequest.body.event).toBe('commit.created');
            expect(mockServer.lastRequest.body.data).toEqual(payload);
        });
    });
    
    describe('Signature Verification', () => {
        test('should generate valid signature', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';
            
            const signature = webhookManager.generateSignature(payload, secret);
            
            expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
        });
        
        test('should verify signature correctly', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';
            
            const signature = webhookManager.generateSignature(payload, secret);
            const isValid = webhookManager.verifySignature(payload, signature, secret);
            
            expect(isValid).toBe(true);
        });
        
        test('should reject invalid signature', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';
            const wrongSecret = 'wrong-secret';
            
            const signature = webhookManager.generateSignature(payload, secret);
            const isValid = webhookManager.verifySignature(payload, signature, wrongSecret);
            
            expect(isValid).toBe(false);
        });
    });
    
    describe('Webhook Testing', () => {
        beforeEach(() => {
            webhookManager.registerWebhook('test-webhook', {
                url: mockServerUrl,
                events: ['test.ping']
            });
        });
        
        test('should test webhook successfully', async () => {
            const result = await webhookManager.testWebhook('test-webhook');
            
            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
        });
        
        test('should handle webhook test failure', async () => {
            // Register webhook with invalid URL
            webhookManager.registerWebhook('invalid-webhook', {
                url: 'http://invalid-url-that-does-not-exist.com',
                events: ['test.ping']
            });
            
            const result = await webhookManager.testWebhook('invalid-webhook');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
    
    describe('Statistics and Export', () => {
        beforeEach(() => {
            webhookManager.registerWebhook('stats-webhook', {
                url: mockServerUrl,
                events: ['commit.created']
            });
        });
        
        test('should track webhook statistics', async () => {
            // Trigger some events
            await webhookManager.triggerEvent('commit.created', { test: 'data' });
            
            const stats = webhookManager.getWebhookStats('stats-webhook');
            
            expect(stats.id).toBe('stats-webhook');
            expect(stats.successCount).toBe(1);
            expect(stats.failureCount).toBe(0);
            expect(stats.successRate).toBe(100);
        });
        
        test('should export webhook configuration', () => {
            const config = webhookManager.exportConfig();
            
            expect(config['stats-webhook']).toBeDefined();
            expect(config['stats-webhook'].url).toBe(mockServerUrl);
            expect(config['stats-webhook'].events).toEqual(['commit.created']);
        });
        
        test('should import webhook configuration', () => {
            const config = {
                'imported-webhook': {
                    url: mockServerUrl,
                    events: ['migration.completed'],
                    active: true
                }
            };
            
            const result = webhookManager.importConfig(config);
            
            expect(result.imported).toContain('imported-webhook');
            expect(result.errors).toHaveLength(0);
            
            const webhook = webhookManager.getWebhook('imported-webhook');
            expect(webhook).toBeDefined();
            expect(webhook.url).toBe(mockServerUrl);
        });
    });
});