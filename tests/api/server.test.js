/**
 * Tests for Histofy API Server
 */

const request = require('supertest');
const { HistofyAPIServer } = require('../../src/api/server');

describe('HistofyAPIServer', () => {
    let server;
    let apiServer;
    
    beforeEach(async () => {
        apiServer = new HistofyAPIServer({
            port: 0, // Use random available port
            host: 'localhost'
        });
        
        // Start server
        await apiServer.start();
        server = apiServer.server;
    });
    
    afterEach(async () => {
        if (apiServer) {
            await apiServer.stop();
        }
    });
    
    describe('Authentication', () => {
        test('should reject requests without API key', async () => {
            const response = await request(server)
                .get('/api/v1/version');
            
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBe('Unauthorized');
        });
        
        test('should accept requests with valid API key', async () => {
            const response = await request(server)
                .get('/api/v1/version')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        
        test('should accept requests with X-API-Key header', async () => {
            const response = await request(server)
                .get('/api/v1/version')
                .set('X-API-Key', apiServer.apiKey);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Rate Limiting', () => {
        test('should enforce rate limits', async () => {
            const requests = [];
            
            // Make many requests quickly
            for (let i = 0; i < 105; i++) {
                requests.push(
                    request(server)
                        .get('/api/v1/version')
                        .set('Authorization', `Bearer ${apiServer.apiKey}`)
                );
            }
            
            const responses = await Promise.all(requests);
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });
    
    describe('API Endpoints', () => {
        test('GET /api/v1/version should return version info', async () => {
            const response = await request(server)
                .get('/api/v1/version')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.version).toBe('3.0.0');
            expect(response.body.data.apiVersion).toBe('v1');
        });
        
        test('GET /api/v1/health should return health status', async () => {
            const response = await request(server)
                .get('/api/v1/health')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('healthy');
            expect(response.body.data.version).toBe('3.0.0');
        });
        
        test('POST /api/v1/config should set configuration', async () => {
            const response = await request(server)
                .post('/api/v1/config')
                .set('Authorization', `Bearer ${apiServer.apiKey}`)
                .send({
                    key: 'test.setting',
                    value: 'test-value'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.key).toBe('test.setting');
            expect(response.body.data.value).toBe('test-value');
        });
        
        test('GET /api/v1/config should get configuration', async () => {
            // First set a value
            await request(server)
                .post('/api/v1/config')
                .set('Authorization', `Bearer ${apiServer.apiKey}`)
                .send({
                    key: 'test.get',
                    value: 'get-value'
                });
            
            // Then get it
            const response = await request(server)
                .get('/api/v1/config?key=test.get')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.key).toBe('test.get');
            expect(response.body.data.value).toBe('get-value');
        });
        
        test('POST /api/v1/batch should handle batch operations', async () => {
            const response = await request(server)
                .post('/api/v1/batch')
                .set('Authorization', `Bearer ${apiServer.apiKey}`)
                .send({
                    commits: [
                        {
                            message: 'Test commit 1',
                            date: '2023-12-25',
                            author: 'Test User <test@example.com>'
                        },
                        {
                            message: 'Test commit 2',
                            date: '2023-12-26',
                            author: 'Test User <test@example.com>'
                        }
                    ],
                    dryRun: true
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Error Handling', () => {
        test('should handle invalid JSON', async () => {
            const response = await request(server)
                .post('/api/v1/config')
                .set('Authorization', `Bearer ${apiServer.apiKey}`)
                .set('Content-Type', 'application/json')
                .send('invalid json');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
        
        test('should handle missing required fields', async () => {
            const response = await request(server)
                .post('/api/v1/config')
                .set('Authorization', `Bearer ${apiServer.apiKey}`)
                .send({
                    key: 'test.key'
                    // Missing value
                });
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBe('Bad Request');
        });
        
        test('should handle 404 for unknown endpoints', async () => {
            const response = await request(server)
                .get('/api/v1/unknown')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBe('Not Found');
        });
        
        test('should handle method not allowed', async () => {
            const response = await request(server)
                .delete('/api/v1/version')
                .set('Authorization', `Bearer ${apiServer.apiKey}`);
            
            expect(response.status).toBe(405);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBe('Method Not Allowed');
        });
    });
    
    describe('CORS', () => {
        test('should handle OPTIONS requests', async () => {
            const response = await request(server)
                .options('/api/v1/version');
            
            expect(response.status).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBe('*');
            expect(response.headers['access-control-allow-methods']).toContain('GET');
        });
    });
});