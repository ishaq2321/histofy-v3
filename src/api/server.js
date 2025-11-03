#!/usr/bin/env node
/**
 * Histofy v3 - RESTful API Server
 * Provides programmatic access to Histofy functionality
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { GitManager } = require('../core/GitManager');
const { ConfigManager } = require('../config/ConfigManager');
const { SecurityUtils } = require('../security/SecurityUtils');
const { AuditLogger } = require('../utils/AuditLogger');

class HistofyAPIServer {
    constructor(options = {}) {
        this.port = options.port || 3000;
        this.host = options.host || 'localhost';
        this.apiKey = options.apiKey || this.generateApiKey();
        this.rateLimiter = new Map();
        this.auditLogger = new AuditLogger();
        this.gitManager = new GitManager();
        this.configManager = new ConfigManager();
        
        // Rate limiting configuration
        this.rateLimit = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 100, // per window
            skipSuccessfulRequests: false
        };
        
        this.server = null;
    }
    
    generateApiKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    async start() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res).catch(error => {
                console.error('API Server Error:', error);
                this.sendError(res, 500, 'Internal Server Error');
            });
        });
        
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, this.host, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Histofy API Server running on http://${this.host}:${this.port}`);
                    console.log(`API Key: ${this.apiKey}`);
                    resolve();
                }
            });
        });
    }
    
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('Histofy API Server stopped');
                    resolve();
                });
            });
        }
    }
    
    async handleRequest(req, res) {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // Parse URL and method
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;
        const query = parsedUrl.query;
        
        // Authentication
        if (!this.authenticate(req)) {
            return this.sendError(res, 401, 'Unauthorized');
        }
        
        // Rate limiting
        if (!this.checkRateLimit(req)) {
            return this.sendError(res, 429, 'Too Many Requests');
        }
        
        // Route handling
        try {
            await this.routeRequest(req, res, method, path, query);
        } catch (error) {
            console.error('Request handling error:', error);
            this.sendError(res, 500, 'Internal Server Error', error.message);
        }
    }
    
    authenticate(req) {
        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers['x-api-key'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            return token === this.apiKey;
        }
        
        if (apiKeyHeader) {
            return apiKeyHeader === this.apiKey;
        }
        
        return false;
    }
    
    checkRateLimit(req) {
        const clientId = req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - this.rateLimit.windowMs;
        
        if (!this.rateLimiter.has(clientId)) {
            this.rateLimiter.set(clientId, []);
        }
        
        const requests = this.rateLimiter.get(clientId);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(time => time > windowStart);
        
        if (validRequests.length >= this.rateLimit.maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        this.rateLimiter.set(clientId, validRequests);
        
        return true;
    }
    
    async routeRequest(req, res, method, path, query) {
        // API routes
        const routes = {
            '/api/v1/status': this.handleStatus.bind(this),
            '/api/v1/commit': this.handleCommit.bind(this),
            '/api/v1/config': this.handleConfig.bind(this),
            '/api/v1/analyze': this.handleAnalyze.bind(this),
            '/api/v1/batch': this.handleBatch.bind(this),
            '/api/v1/audit': this.handleAudit.bind(this),
            '/api/v1/health': this.handleHealth.bind(this),
            '/api/v1/version': this.handleVersion.bind(this)
        };
        
        // Find matching route
        const handler = routes[path];
        if (!handler) {
            return this.sendError(res, 404, 'Not Found');
        }
        
        // Parse request body for POST/PUT requests
        let body = null;
        if (method === 'POST' || method === 'PUT') {
            body = await this.parseRequestBody(req);
        }
        
        // Call handler
        await handler(req, res, method, query, body);
    }
    
    async parseRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : null);
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
            req.on('error', reject);
        });
    }
    
    async handleStatus(req, res, method, query, body) {
        if (method !== 'GET') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        try {
            const status = await this.gitManager.getRepositoryStatus();
            const remoteInfo = query.remote === 'true' ? await this.gitManager.getRemoteInfo() : null;
            
            this.sendSuccess(res, {
                status,
                remote: remoteInfo,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.sendError(res, 400, 'Bad Request', error.message);
        }
    }
    
    async handleCommit(req, res, method, query, body) {
        if (method === 'GET') {
            // Get commit history
            try {
                const commits = await this.gitManager.getCommitHistory(query.limit || 10);
                this.sendSuccess(res, { commits });
            } catch (error) {
                this.sendError(res, 400, 'Bad Request', error.message);
            }
        } else if (method === 'POST') {
            // Create new commit
            if (!body || !body.message) {
                return this.sendError(res, 400, 'Bad Request', 'Message is required');
            }
            
            try {
                // Validate input
                SecurityUtils.validateCommitMessage(body.message);
                if (body.date) SecurityUtils.validateDate(body.date);
                if (body.author) SecurityUtils.validateAuthor(body.author);
                
                const result = await this.gitManager.createCommit({
                    message: body.message,
                    date: body.date,
                    author: body.author,
                    addAll: body.addAll || false,
                    dryRun: body.dryRun || false
                });
                
                // Log audit event
                await this.auditLogger.logOperation('api_commit', {
                    message: body.message,
                    date: body.date,
                    author: body.author,
                    result: result.success
                });
                
                this.sendSuccess(res, result, 201);
            } catch (error) {
                this.sendError(res, 400, 'Bad Request', error.message);
            }
        } else {
            this.sendError(res, 405, 'Method Not Allowed');
        }
    }
    
    async handleConfig(req, res, method, query, body) {
        if (method === 'GET') {
            try {
                if (query.key) {
                    const value = await this.configManager.get(query.key);
                    this.sendSuccess(res, { key: query.key, value });
                } else {
                    const config = await this.configManager.getAll();
                    this.sendSuccess(res, { config });
                }
            } catch (error) {
                this.sendError(res, 400, 'Bad Request', error.message);
            }
        } else if (method === 'POST' || method === 'PUT') {
            if (!body || !body.key || body.value === undefined) {
                return this.sendError(res, 400, 'Bad Request', 'Key and value are required');
            }
            
            try {
                SecurityUtils.validateConfigKey(body.key);
                await this.configManager.set(body.key, body.value);
                
                await this.auditLogger.logOperation('api_config_set', {
                    key: body.key,
                    valueType: typeof body.value
                });
                
                this.sendSuccess(res, { key: body.key, value: body.value });
            } catch (error) {
                this.sendError(res, 400, 'Bad Request', error.message);
            }
        } else if (method === 'DELETE') {
            if (!query.key) {
                return this.sendError(res, 400, 'Bad Request', 'Key is required');
            }
            
            try {
                await this.configManager.delete(query.key);
                
                await this.auditLogger.logOperation('api_config_delete', {
                    key: query.key
                });
                
                this.sendSuccess(res, { deleted: query.key });
            } catch (error) {
                this.sendError(res, 400, 'Bad Request', error.message);
            }
        } else {
            this.sendError(res, 405, 'Method Not Allowed');
        }
    }
    
    async handleAnalyze(req, res, method, query, body) {
        if (method !== 'GET') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        try {
            const { CommitAnalyzer } = require('../utils/CommitAnalyzer');
            const analyzer = new CommitAnalyzer();
            
            const analysis = await analyzer.analyzeRepository({
                includeStats: query.stats !== 'false',
                includeTemporal: query.temporal !== 'false',
                includeAuthors: query.authors !== 'false',
                includeHealth: query.health !== 'false'
            });
            
            this.sendSuccess(res, analysis);
        } catch (error) {
            this.sendError(res, 400, 'Bad Request', error.message);
        }
    }
    
    async handleBatch(req, res, method, query, body) {
        if (method !== 'POST') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        if (!body || !body.commits || !Array.isArray(body.commits)) {
            return this.sendError(res, 400, 'Bad Request', 'Commits array is required');
        }
        
        try {
            const { BatchCommitManager } = require('../utils/BatchCommitManager');
            const batchManager = new BatchCommitManager();
            
            // Validate all commits
            for (const commit of body.commits) {
                SecurityUtils.validateCommitMessage(commit.message);
                if (commit.date) SecurityUtils.validateDate(commit.date);
                if (commit.author) SecurityUtils.validateAuthor(commit.author);
            }
            
            const result = await batchManager.processBatch(body.commits, {
                dryRun: body.dryRun || false,
                template: body.template
            });
            
            await this.auditLogger.logOperation('api_batch_commit', {
                commitCount: body.commits.length,
                dryRun: body.dryRun || false,
                success: result.success
            });
            
            this.sendSuccess(res, result);
        } catch (error) {
            this.sendError(res, 400, 'Bad Request', error.message);
        }
    }
    
    async handleAudit(req, res, method, query, body) {
        if (method !== 'GET') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        try {
            const logs = await this.auditLogger.getLogs({
                limit: parseInt(query.limit) || 100,
                offset: parseInt(query.offset) || 0,
                startDate: query.startDate,
                endDate: query.endDate,
                operation: query.operation
            });
            
            this.sendSuccess(res, { logs });
        } catch (error) {
            this.sendError(res, 400, 'Bad Request', error.message);
        }
    }
    
    async handleHealth(req, res, method, query, body) {
        if (method !== 'GET') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '3.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            git: await this.checkGitHealth(),
            config: await this.checkConfigHealth()
        };
        
        this.sendSuccess(res, health);
    }
    
    async handleVersion(req, res, method, query, body) {
        if (method !== 'GET') {
            return this.sendError(res, 405, 'Method Not Allowed');
        }
        
        const version = {
            version: '3.0.0',
            apiVersion: 'v1',
            node: process.version,
            platform: process.platform,
            arch: process.arch
        };
        
        this.sendSuccess(res, version);
    }
    
    async checkGitHealth() {
        try {
            await this.gitManager.getRepositoryStatus();
            return { status: 'healthy' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
    
    async checkConfigHealth() {
        try {
            await this.configManager.getAll();
            return { status: 'healthy' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
    
    sendSuccess(res, data, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data,
            timestamp: new Date().toISOString()
        }));
    }
    
    sendError(res, statusCode, message, details = null) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: {
                code: statusCode,
                message,
                details
            },
            timestamp: new Date().toISOString()
        }));
    }
}

// CLI interface for starting the server
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        const value = args[i + 1];
        
        switch (key) {
            case 'port':
                options.port = parseInt(value);
                break;
            case 'host':
                options.host = value;
                break;
            case 'api-key':
                options.apiKey = value;
                break;
        }
    }
    
    const server = new HistofyAPIServer(options);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down API server...');
        await server.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\nShutting down API server...');
        await server.stop();
        process.exit(0);
    });
    
    // Start server
    server.start().catch(error => {
        console.error('Failed to start API server:', error);
        process.exit(1);
    });
}

module.exports = { HistofyAPIServer };