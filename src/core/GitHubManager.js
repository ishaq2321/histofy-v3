/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const axios = require('axios');

class GitHubManager {
  constructor(token = null) {
    this.token = token || process.env.GITHUB_TOKEN;
    this.baseURL = 'https://api.github.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Histofy-CLI/3.0.0'
      }
    });

    if (this.token) {
      this.client.defaults.headers.common['Authorization'] = `token ${this.token}`;
    }
  }

  /**
   * Test GitHub API connection
   */
  async testConnection() {
    try {
      const response = await this.client.get('/user');
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Validate repository access
   */
  async validateRepoAccess(owner, repo) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      const repoData = response.data;

      return {
        success: true,
        hasAccess: true,
        permissions: repoData.permissions || {},
        isPrivate: repoData.private,
        canPush: repoData.permissions?.push || false
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          hasAccess: false,
          error: 'Repository not found or no access'
        };
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = GitHubManager;
