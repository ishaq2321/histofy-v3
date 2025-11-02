/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const axios = require('axios');
const moment = require('moment');
const { EventEmitter } = require('events');

class GitHubManager extends EventEmitter {
  constructor(token = null) {
    super();
    
    this.token = token || process.env.GITHUB_TOKEN;
    this.baseURL = 'https://api.github.com';
    
    // Rate limiting configuration
    this.rateLimits = {
      core: { remaining: 5000, reset: Date.now() + 3600000 }, // 1 hour
      search: { remaining: 30, reset: Date.now() + 60000 }, // 1 minute
      graphql: { remaining: 5000, reset: Date.now() + 3600000 }
    };
    
    // Request queue for rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffFactor: 2
    };
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 second timeout
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Histofy-CLI/3.0.0'
      }
    });

    if (this.token) {
      this.client.defaults.headers.common['Authorization'] = `token ${this.token}`;
    }

    // Setup response interceptor for rate limit handling
    this.setupResponseInterceptor();
  }

  /**
   * Setup response interceptor to handle rate limits and errors
   */
  setupResponseInterceptor() {
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit information from headers
        this.updateRateLimits(response.headers);
        return response;
      },
      async (error) => {
        // Handle rate limiting
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          const waitTime = resetTime - Date.now();
          
          this.emit('rateLimited', { waitTime, resetTime });
          
          if (waitTime > 0 && waitTime < 3600000) { // Wait up to 1 hour
            await this.sleep(waitTime);
            return this.client.request(error.config);
          }
        }
        
        // Handle other retryable errors
        if (this.isRetryableError(error) && !error.config._retryCount) {
          return this.retryRequest(error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Update rate limit information from response headers
   */
  updateRateLimits(headers) {
    const coreRemaining = headers['x-ratelimit-remaining'];
    const coreReset = headers['x-ratelimit-reset'];
    
    if (coreRemaining !== undefined && coreReset !== undefined) {
      this.rateLimits.core = {
        remaining: parseInt(coreRemaining),
        reset: parseInt(coreReset) * 1000
      };
    }

    // Emit rate limit update event
    this.emit('rateLimitUpdate', this.rateLimits);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error.response) return true; // Network errors are retryable
    
    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Retry request with exponential backoff
   */
  async retryRequest(error) {
    const config = error.config;
    config._retryCount = config._retryCount || 0;
    
    if (config._retryCount >= this.retryConfig.maxRetries) {
      return Promise.reject(error);
    }
    
    config._retryCount++;
    
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, config._retryCount - 1),
      this.retryConfig.maxDelay
    );
    
    this.emit('retrying', { attempt: config._retryCount, delay, error: error.message });
    
    await this.sleep(delay);
    return this.client.request(config);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make rate-limited request
   */
  async makeRequest(requestFn, priority = 'normal') {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFn,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Sort queue by priority (high priority first)
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      while (this.requestQueue.length > 0) {
        // Check rate limits
        if (this.rateLimits.core.remaining <= 1 && Date.now() < this.rateLimits.core.reset) {
          const waitTime = this.rateLimits.core.reset - Date.now();
          this.emit('rateLimitWait', { waitTime });
          await this.sleep(waitTime);
        }
        
        const request = this.requestQueue.shift();
        
        try {
          const result = await request.requestFn();
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
        
        // Small delay between requests to be respectful
        await this.sleep(100);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return {
      core: {
        remaining: this.rateLimits.core.remaining,
        reset: new Date(this.rateLimits.core.reset),
        resetIn: Math.max(0, this.rateLimits.core.reset - Date.now())
      },
      search: {
        remaining: this.rateLimits.search.remaining,
        reset: new Date(this.rateLimits.search.reset),
        resetIn: Math.max(0, this.rateLimits.search.reset - Date.now())
      }
    };
  }

  /**
   * Test GitHub API connection with enhanced error handling
   */
  async testConnection() {
    return this.makeRequest(async () => {
      try {
        const response = await this.client.get('/user');
        return {
          success: true,
          user: response.data,
          rateLimits: this.getRateLimitStatus()
        };
      } catch (error) {
        const errorInfo = this.parseError(error);
        return {
          success: false,
          error: errorInfo.message,
          errorCode: errorInfo.code,
          retryable: errorInfo.retryable,
          rateLimits: this.getRateLimitStatus()
        };
      }
    }, 'high');
  }

  /**
   * Parse and categorize API errors
   */
  parseError(error) {
    if (!error.response) {
      return {
        message: 'Network error - please check your internet connection',
        code: 'NETWORK_ERROR',
        retryable: true
      };
    }

    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return {
          message: 'Invalid or expired GitHub token',
          code: 'INVALID_TOKEN',
          retryable: false,
          suggestion: 'Please check your GitHub token configuration'
        };
      
      case 403:
        if (error.response.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
          return {
            message: `Rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`,
            code: 'RATE_LIMITED',
            retryable: true,
            resetTime
          };
        }
        return {
          message: data?.message || 'Access forbidden - insufficient permissions',
          code: 'FORBIDDEN',
          retryable: false,
          suggestion: 'Check your token permissions'
        };
      
      case 404:
        return {
          message: data?.message || 'Resource not found',
          code: 'NOT_FOUND',
          retryable: false
        };
      
      case 422:
        return {
          message: data?.message || 'Validation failed',
          code: 'VALIDATION_ERROR',
          retryable: false,
          errors: data?.errors
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: 'GitHub API server error - please try again later',
          code: 'SERVER_ERROR',
          retryable: true
        };
      
      default:
        return {
          message: data?.message || error.message || 'Unknown API error',
          code: 'UNKNOWN_ERROR',
          retryable: status >= 500
        };
    }
  }

  /**
   * Get repository information with enhanced error handling
   */
  async getRepository(owner, repo) {
    return this.makeRequest(async () => {
      try {
        const response = await this.client.get(`/repos/${owner}/${repo}`);
        return {
          success: true,
          repository: response.data,
          rateLimits: this.getRateLimitStatus()
        };
      } catch (error) {
        const errorInfo = this.parseError(error);
        return {
          success: false,
          error: errorInfo.message,
          errorCode: errorInfo.code,
          retryable: errorInfo.retryable,
          suggestion: errorInfo.suggestion,
          rateLimits: this.getRateLimitStatus()
        };
      }
    }, 'normal');
  }

  /**
   * Create a new repository
   */
  async createRepository(name, options = {}) {
    try {
      const payload = {
        name,
        description: options.description || `Created by Histofy v3`,
        private: options.private || false,
        has_issues: options.hasIssues || true,
        has_projects: options.hasProjects || true,
        has_wiki: options.hasWiki || true,
        auto_init: options.autoInit || false
      };

      const response = await this.client.post('/user/repos', payload);
      return {
        success: true,
        repository: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get contribution data for a user
   */
  async getContributions(username, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();
      const startDate = `${targetYear}-01-01T00:00:00Z`;
      const endDate = `${targetYear}-12-31T23:59:59Z`;

      // GitHub GraphQL query for contribution data
      const query = `
        query($username: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $username) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `;

      const response = await axios.post('https://api.github.com/graphql', {
        query,
        variables: {
          username,
          from: startDate,
          to: endDate
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const calendar = response.data.data.user.contributionsCollection.contributionCalendar;
      
      // Flatten the weeks into a simple array of days
      const contributions = {};
      calendar.weeks.forEach(week => {
        week.contributionDays.forEach(day => {
          contributions[day.date] = day.contributionCount;
        });
      });

      return {
        success: true,
        totalContributions: calendar.totalContributions,
        contributions
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }



  /**
   * Get commit activity for a repository
   */
  async getCommitActivity(owner, repo, since = null) {
    try {
      const params = {};
      if (since) {
        params.since = moment(since).toISOString();
      }

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
        params
      });

      return {
        success: true,
        commits: response.data.map(commit => ({
          sha: commit.sha,
          date: commit.commit.author.date,
          author: commit.commit.author.name,
          message: commit.commit.message
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Validate repository access with comprehensive error handling
   */
  async validateRepoAccess(owner, repo) {
    return this.makeRequest(async () => {
      try {
        const response = await this.client.get(`/repos/${owner}/${repo}`);
        const repoData = response.data;
        
        return {
          success: true,
          hasAccess: true,
          permissions: repoData.permissions || {},
          isPrivate: repoData.private,
          canPush: repoData.permissions?.push || false,
          canAdmin: repoData.permissions?.admin || false,
          rateLimits: this.getRateLimitStatus()
        };
      } catch (error) {
        const errorInfo = this.parseError(error);
        
        if (error.response?.status === 404) {
          return {
            success: false,
            hasAccess: false,
            error: 'Repository not found or access denied',
            errorCode: 'NOT_FOUND',
            suggestion: 'Check repository name and your access permissions'
          };
        }
        
        return {
          success: false,
          hasAccess: false,
          error: errorInfo.message,
          errorCode: errorInfo.code,
          retryable: errorInfo.retryable,
          suggestion: errorInfo.suggestion,
          rateLimits: this.getRateLimitStatus()
        };
      }
    }, 'normal');
  }

  /**
   * Validate GitHub token with detailed feedback
   */
  async validateToken() {
    return this.makeRequest(async () => {
      try {
        if (!this.token) {
          return {
            valid: false,
            error: 'No GitHub token provided',
            suggestion: 'Set your GitHub token with: histofy config set github.token YOUR_TOKEN'
          };
        }

        const response = await this.client.get('/user');
        const user = response.data;
        
        // Check token scopes
        const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
        const requiredScopes = ['repo'];
        const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
        
        return {
          valid: true,
          user: {
            login: user.login,
            name: user.name,
            email: user.email,
            publicRepos: user.public_repos,
            privateRepos: user.total_private_repos
          },
          scopes,
          missingScopes,
          warnings: missingScopes.length > 0 ? 
            [`Missing required scopes: ${missingScopes.join(', ')}`] : [],
          rateLimits: this.getRateLimitStatus()
        };
      } catch (error) {
        const errorInfo = this.parseError(error);
        return {
          valid: false,
          error: errorInfo.message,
          errorCode: errorInfo.code,
          suggestion: errorInfo.suggestion,
          rateLimits: this.getRateLimitStatus()
        };
      }
    }, 'high');
  }

  /**
   * Get comprehensive API status and health check
   */
  async getApiStatus() {
    return this.makeRequest(async () => {
      try {
        // Check API status
        const statusResponse = await axios.get('https://www.githubstatus.com/api/v2/status.json', {
          timeout: 5000
        });
        
        // Get rate limits
        const rateLimits = this.getRateLimitStatus();
        
        // Test basic connectivity
        const userResponse = await this.client.get('/user');
        
        return {
          success: true,
          apiStatus: statusResponse.data.status,
          connectivity: 'healthy',
          rateLimits,
          user: {
            login: userResponse.data.login,
            name: userResponse.data.name
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        const errorInfo = this.parseError(error);
        return {
          success: false,
          error: errorInfo.message,
          errorCode: errorInfo.code,
          connectivity: 'unhealthy',
          rateLimits: this.getRateLimitStatus(),
          timestamp: new Date().toISOString()
        };
      }
    }, 'low');
  }

  /**
   * Parse repository information from GitHub URL
   */
  parseRepoFromUrl(url) {
    try {
      // Handle different GitHub URL formats
      const patterns = [
        /github\.com[:/](.+?)\/(.+?)(?:\.git)?(?:\/)?$/,
        /^(.+?)\/(.+?)$/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace('.git', ''),
            fullName: `${match[1]}/${match[2].replace('.git', '')}`
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = GitHubManager;
