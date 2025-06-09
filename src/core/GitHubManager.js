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
   * Get repository information
   */
  async getRepository(owner, repo) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
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
   * Deploy commits to create a contribution pattern
   */
  async deployPattern(repoName, commits, options = {}) {
    try {
      const results = [];
      
      for (const commit of commits) {
        const result = await this.createCommitWithDate(
          repoName,
          commit.message,
          commit.date,
          commit.files || [],
          options
        );
        results.push(result);
        
        // Add delay to avoid rate limiting
        if (options.delay) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
      }

      return {
        success: true,
        results,
        totalCommits: results.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a commit with specific date (requires local git operations)
   */
  async createCommitWithDate(repoName, message, date, files = [], options = {}) {
    // This would typically be handled by the GitManager
    // Here we provide the interface for GitHub API operations
    return {
      success: true,
      message: 'Commit created locally - push to GitHub to deploy',
      date,
      files
    };
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
