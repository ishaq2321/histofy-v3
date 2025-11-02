/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * CommitAnalyzer - Comprehensive commit history analysis and statistics
 */

const GitManager = require('../core/GitManager');
const SecurityUtils = require('../security/SecurityUtils');
const ValidationUtils = require('./ValidationUtils');
const { ProgressUtils } = require('./progress');
const moment = require('moment');

class CommitAnalyzer {
  constructor(repoPath = null) {
    this.gitManager = new GitManager(repoPath);
    this.analysisCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive commit statistics
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Comprehensive statistics
   */
  async getComprehensiveStats(options = {}) {
    const {
      since = null,
      until = null,
      author = null,
      branch = null,
      maxCommits = 1000,
      includeFiles = false,
      includeDiffs = false
    } = options;

    const cacheKey = `comprehensive-${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const progress = ProgressUtils.spinner('Analyzing commit history...');
    progress.start();

    try {
      // Get commit history
      const commits = await this.gitManager.getCommitHistory({
        since,
        until,
        author,
        branch,
        limit: maxCommits,
        includeFiles,
        includeDiffs
      });

      progress.update('Processing commit data...');

      const stats = {
        overview: this.calculateOverviewStats(commits),
        temporal: this.calculateTemporalStats(commits),
        authors: this.calculateAuthorStats(commits),
        messages: this.calculateMessageStats(commits),
        patterns: this.calculatePatternStats(commits),
        health: this.calculateHealthStats(commits),
        trends: this.calculateTrendStats(commits)
      };

      if (includeFiles) {
        stats.files = this.calculateFileStats(commits);
      }

      if (includeDiffs) {
        stats.changes = this.calculateChangeStats(commits);
      }

      progress.succeed(`Analyzed ${commits.length} commits`);
      
      this.setCachedResult(cacheKey, stats);
      return stats;
    } catch (error) {
      progress.fail('Analysis failed');
      throw error;
    }
  }

  /**
   * Calculate overview statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Overview statistics
   */
  calculateOverviewStats(commits) {
    if (commits.length === 0) {
      return {
        totalCommits: 0,
        uniqueAuthors: 0,
        dateRange: null,
        averageCommitsPerDay: 0,
        repositoryAge: 0
      };
    }

    const authors = new Set(commits.map(c => c.author));
    const dates = commits.map(c => new Date(c.date)).sort((a, b) => a - b);
    const firstCommit = dates[0];
    const lastCommit = dates[dates.length - 1];
    const daysDiff = Math.ceil((lastCommit - firstCommit) / (1000 * 60 * 60 * 24)) || 1;

    return {
      totalCommits: commits.length,
      uniqueAuthors: authors.size,
      dateRange: {
        first: firstCommit.toISOString(),
        last: lastCommit.toISOString(),
        span: daysDiff
      },
      averageCommitsPerDay: Math.round((commits.length / daysDiff) * 100) / 100,
      repositoryAge: daysDiff
    };
  }

  /**
   * Calculate temporal statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Temporal statistics
   */
  calculateTemporalStats(commits) {
    if (commits.length === 0) {
      return {
        byHour: {},
        byDayOfWeek: {},
        byMonth: {},
        byYear: {},
        patterns: []
      };
    }

    const byHour = {};
    const byDayOfWeek = {};
    const byMonth = {};
    const byYear = {};
    const dailyCommits = {};

    // Initialize counters
    for (let i = 0; i < 24; i++) byHour[i] = 0;
    for (let i = 0; i < 7; i++) byDayOfWeek[i] = 0;
    for (let i = 1; i <= 12; i++) byMonth[i] = 0;

    commits.forEach(commit => {
      const date = moment(commit.date);
      const hour = date.hour();
      const dayOfWeek = date.day();
      const month = date.month() + 1;
      const year = date.year();
      const dayKey = date.format('YYYY-MM-DD');

      byHour[hour]++;
      byDayOfWeek[dayOfWeek]++;
      byMonth[month]++;
      byYear[year] = (byYear[year] || 0) + 1;
      dailyCommits[dayKey] = (dailyCommits[dayKey] || 0) + 1;
    });

    // Find patterns
    const patterns = this.identifyTemporalPatterns({
      byHour,
      byDayOfWeek,
      byMonth,
      dailyCommits
    });

    return {
      byHour,
      byDayOfWeek: {
        0: byDayOfWeek[0], // Sunday
        1: byDayOfWeek[1], // Monday
        2: byDayOfWeek[2], // Tuesday
        3: byDayOfWeek[3], // Wednesday
        4: byDayOfWeek[4], // Thursday
        5: byDayOfWeek[5], // Friday
        6: byDayOfWeek[6]  // Saturday
      },
      byMonth,
      byYear,
      patterns,
      peakHour: Object.keys(byHour).reduce((a, b) => byHour[a] > byHour[b] ? a : b),
      peakDay: Object.keys(byDayOfWeek).reduce((a, b) => byDayOfWeek[a] > byDayOfWeek[b] ? a : b)
    };
  }

  /**
   * Calculate author statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Author statistics
   */
  calculateAuthorStats(commits) {
    if (commits.length === 0) {
      return {
        byAuthor: {},
        topAuthors: [],
        authorActivity: {},
        collaboration: {}
      };
    }

    const byAuthor = {};
    const authorActivity = {};
    const authorFirstCommit = {};
    const authorLastCommit = {};

    commits.forEach(commit => {
      const author = commit.author;
      const date = new Date(commit.date);
      const monthKey = moment(date).format('YYYY-MM');

      // Count commits by author
      byAuthor[author] = (byAuthor[author] || 0) + 1;

      // Track activity by month
      if (!authorActivity[author]) {
        authorActivity[author] = {};
      }
      authorActivity[author][monthKey] = (authorActivity[author][monthKey] || 0) + 1;

      // Track first and last commits
      if (!authorFirstCommit[author] || date < authorFirstCommit[author]) {
        authorFirstCommit[author] = date;
      }
      if (!authorLastCommit[author] || date > authorLastCommit[author]) {
        authorLastCommit[author] = date;
      }
    });

    // Calculate top authors
    const topAuthors = Object.entries(byAuthor)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([author, count]) => ({
        author,
        commits: count,
        percentage: Math.round((count / commits.length) * 100),
        firstCommit: authorFirstCommit[author]?.toISOString(),
        lastCommit: authorLastCommit[author]?.toISOString(),
        activeDays: this.calculateActiveDays(commits.filter(c => c.author === author))
      }));

    // Calculate collaboration metrics
    const collaboration = this.calculateCollaborationMetrics(commits, byAuthor);

    return {
      byAuthor,
      topAuthors,
      authorActivity,
      collaboration,
      totalAuthors: Object.keys(byAuthor).length
    };
  }

  /**
   * Calculate message statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Message statistics
   */
  calculateMessageStats(commits) {
    if (commits.length === 0) {
      return {
        averageLength: 0,
        lengthDistribution: {},
        commonWords: [],
        patterns: [],
        conventions: {}
      };
    }

    const lengths = commits.map(c => c.message.length);
    const averageLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    
    // Length distribution
    const lengthDistribution = {
      short: lengths.filter(l => l < 30).length,
      medium: lengths.filter(l => l >= 30 && l <= 72).length,
      long: lengths.filter(l => l > 72).length
    };

    // Word frequency analysis
    const wordCounts = {};
    const patterns = {
      conventional: 0,
      fixPattern: 0,
      featurePattern: 0,
      mergeCommits: 0,
      revertCommits: 0
    };

    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      const words = message.split(/\s+/).filter(word => word.length > 2);
      
      words.forEach(word => {
        const cleanWord = word.replace(/[^a-z0-9]/g, '');
        if (cleanWord.length > 2) {
          wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
        }
      });

      // Pattern detection
      if (/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(message)) {
        patterns.conventional++;
      }
      if (/^(fix|fixes|fixed|bug)/i.test(message)) {
        patterns.fixPattern++;
      }
      if (/^(feat|feature|add)/i.test(message)) {
        patterns.featurePattern++;
      }
      if (/^merge/i.test(message)) {
        patterns.mergeCommits++;
      }
      if (/^revert/i.test(message)) {
        patterns.revertCommits++;
      }
    });

    // Top words
    const commonWords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count, percentage: Math.round((count / commits.length) * 100) }));

    // Convention analysis
    const conventions = {
      conventionalCommits: Math.round((patterns.conventional / commits.length) * 100),
      averageLength,
      recommendedLength: averageLength <= 72 ? 'good' : 'too_long',
      consistency: this.calculateMessageConsistency(commits)
    };

    return {
      averageLength,
      lengthDistribution,
      commonWords,
      patterns,
      conventions
    };
  }

  /**
   * Calculate pattern statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Pattern statistics
   */
  calculatePatternStats(commits) {
    if (commits.length === 0) {
      return {
        commitFrequency: {},
        burstyPeriods: [],
        quietPeriods: [],
        workingPatterns: {}
      };
    }

    const dailyCommits = {};
    const weeklyCommits = {};
    const monthlyCommits = {};

    commits.forEach(commit => {
      const date = moment(commit.date);
      const dayKey = date.format('YYYY-MM-DD');
      const weekKey = date.format('YYYY-[W]WW');
      const monthKey = date.format('YYYY-MM');

      dailyCommits[dayKey] = (dailyCommits[dayKey] || 0) + 1;
      weeklyCommits[weekKey] = (weeklyCommits[weekKey] || 0) + 1;
      monthlyCommits[monthKey] = (monthlyCommits[monthKey] || 0) + 1;
    });

    // Find bursty periods (days with unusually high activity)
    const dailyCounts = Object.values(dailyCommits);
    const avgDaily = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
    const threshold = avgDaily * 2;

    const burstyPeriods = Object.entries(dailyCommits)
      .filter(([, count]) => count >= threshold)
      .map(([date, count]) => ({ date, commits: count, factor: Math.round(count / avgDaily * 10) / 10 }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);

    // Find quiet periods (weeks with no activity)
    const allWeeks = this.generateWeekRange(commits);
    const quietPeriods = allWeeks
      .filter(week => !weeklyCommits[week])
      .slice(0, 10);

    // Working patterns
    const workingPatterns = this.analyzeWorkingPatterns(commits);

    return {
      commitFrequency: {
        daily: dailyCommits,
        weekly: weeklyCommits,
        monthly: monthlyCommits
      },
      burstyPeriods,
      quietPeriods,
      workingPatterns,
      averageDaily: Math.round(avgDaily * 100) / 100
    };
  }

  /**
   * Calculate health statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Health statistics
   */
  calculateHealthStats(commits) {
    if (commits.length === 0) {
      return {
        score: 0,
        factors: {},
        recommendations: []
      };
    }

    const factors = {
      frequency: this.calculateFrequencyHealth(commits),
      messageQuality: this.calculateMessageQualityHealth(commits),
      authorDiversity: this.calculateAuthorDiversityHealth(commits),
      consistency: this.calculateConsistencyHealth(commits),
      recency: this.calculateRecencyHealth(commits)
    };

    // Calculate overall score (0-100)
    const weights = {
      frequency: 0.2,
      messageQuality: 0.25,
      authorDiversity: 0.15,
      consistency: 0.2,
      recency: 0.2
    };

    const score = Math.round(
      Object.entries(factors).reduce((total, [factor, value]) => {
        return total + (value * weights[factor]);
      }, 0)
    );

    const recommendations = this.generateHealthRecommendations(factors, score);

    return {
      score,
      factors,
      recommendations,
      grade: this.getHealthGrade(score)
    };
  }

  /**
   * Calculate trend statistics
   * @param {Array} commits - Array of commits
   * @returns {Object} Trend statistics
   */
  calculateTrendStats(commits) {
    if (commits.length === 0) {
      return {
        activity: 'stable',
        velocity: 0,
        momentum: 'neutral',
        predictions: {}
      };
    }

    const monthlyData = this.getMonthlyTrends(commits);
    const velocity = this.calculateVelocity(monthlyData);
    const momentum = this.calculateMomentum(monthlyData);
    const activity = this.classifyActivity(velocity, momentum);
    const predictions = this.generatePredictions(monthlyData);

    return {
      activity,
      velocity,
      momentum,
      monthlyData,
      predictions
    };
  }

  /**
   * Generate commit activity heatmap data
   * @param {Object} options - Heatmap options
   * @returns {Promise<Object>} Heatmap data
   */
  async generateHeatmap(options = {}) {
    const {
      since = moment().subtract(1, 'year').toDate(),
      until = new Date(),
      author = null
    } = options;

    const commits = await this.gitManager.getCommitHistory({
      since: since.toISOString(),
      until: until.toISOString(),
      author,
      limit: 10000
    });

    const heatmapData = {};
    const start = moment(since);
    const end = moment(until);

    // Initialize all days with 0
    for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
      heatmapData[date.format('YYYY-MM-DD')] = 0;
    }

    // Count commits per day
    commits.forEach(commit => {
      const date = moment(commit.date).format('YYYY-MM-DD');
      if (heatmapData.hasOwnProperty(date)) {
        heatmapData[date]++;
      }
    });

    // Calculate intensity levels (0-4)
    const values = Object.values(heatmapData);
    const max = Math.max(...values);
    const intensityData = {};

    Object.entries(heatmapData).forEach(([date, count]) => {
      let intensity = 0;
      if (count > 0) {
        intensity = Math.min(4, Math.ceil((count / max) * 4));
      }
      intensityData[date] = { count, intensity };
    });

    return {
      data: intensityData,
      summary: {
        totalDays: Object.keys(heatmapData).length,
        activeDays: values.filter(v => v > 0).length,
        totalCommits: values.reduce((a, b) => a + b, 0),
        maxCommitsPerDay: max,
        averageCommitsPerDay: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
      }
    };
  }

  /**
   * Analyze commit message patterns and suggest improvements
   * @param {Array} commits - Array of commits
   * @returns {Object} Pattern analysis and suggestions
   */
  analyzeCommitPatterns(commits) {
    const analysis = {
      patterns: {
        conventional: 0,
        imperative: 0,
        descriptive: 0,
        vague: 0
      },
      issues: [],
      suggestions: [],
      examples: {
        good: [],
        bad: []
      }
    };

    commits.forEach((commit, index) => {
      const message = commit.message;
      const firstLine = message.split('\n')[0];

      // Pattern detection
      if (/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(firstLine)) {
        analysis.patterns.conventional++;
      } else if (/^[A-Z][a-z]/.test(firstLine) && !/^(Add|Fix|Update|Remove|Create)/.test(firstLine)) {
        analysis.patterns.descriptive++;
      } else if (/^(Add|Fix|Update|Remove|Create|Implement|Refactor)/.test(firstLine)) {
        analysis.patterns.imperative++;
      } else if (firstLine.length < 10 || /^(wip|temp|test|debug)/i.test(firstLine)) {
        analysis.patterns.vague++;
        analysis.examples.bad.push({ index, message: firstLine, issue: 'Too vague or short' });
      }

      // Issue detection
      if (firstLine.length > 72) {
        analysis.issues.push({ index, type: 'too_long', message: firstLine });
      }
      if (firstLine.endsWith('.')) {
        analysis.issues.push({ index, type: 'ends_with_period', message: firstLine });
      }
      if (/^[a-z]/.test(firstLine)) {
        analysis.issues.push({ index, type: 'not_capitalized', message: firstLine });
      }

      // Collect good examples
      if (firstLine.length >= 10 && firstLine.length <= 72 && 
          /^[A-Z]/.test(firstLine) && !firstLine.endsWith('.') &&
          !/^(wip|temp|test|debug)/i.test(firstLine)) {
        analysis.examples.good.push({ index, message: firstLine });
      }
    });

    // Generate suggestions
    analysis.suggestions = this.generateCommitSuggestions(analysis, commits.length);

    return analysis;
  }

  /**
   * Get cached analysis result
   * @private
   */
  getCachedResult(key) {
    const cached = this.analysisCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached analysis result
   * @private
   */
  setCachedResult(key, data) {
    this.analysisCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Helper methods for calculations
   * @private
   */
  identifyTemporalPatterns(data) {
    const patterns = [];
    
    // Find peak hours
    const peakHour = Object.entries(data.byHour)
      .sort(([, a], [, b]) => b - a)[0];
    patterns.push({
      type: 'peak_hour',
      description: `Most active at ${peakHour[0]}:00 (${peakHour[1]} commits)`,
      value: peakHour[0]
    });

    // Weekend vs weekday pattern
    const weekendCommits = data.byDayOfWeek[0] + data.byDayOfWeek[6];
    const weekdayCommits = Object.values(data.byDayOfWeek).reduce((a, b) => a + b, 0) - weekendCommits;
    
    if (weekendCommits > weekdayCommits * 0.3) {
      patterns.push({
        type: 'weekend_worker',
        description: 'Significant weekend activity detected',
        value: Math.round((weekendCommits / (weekendCommits + weekdayCommits)) * 100)
      });
    }

    return patterns;
  }

  calculateActiveDays(commits) {
    const uniqueDays = new Set(commits.map(c => moment(c.date).format('YYYY-MM-DD')));
    return uniqueDays.size;
  }

  calculateCollaborationMetrics(commits, byAuthor) {
    const authors = Object.keys(byAuthor);
    const totalCommits = commits.length;
    
    return {
      diversity: authors.length,
      concentration: Math.max(...Object.values(byAuthor)) / totalCommits,
      balance: Math.min(...Object.values(byAuthor)) / Math.max(...Object.values(byAuthor))
    };
  }

  calculateMessageConsistency(commits) {
    // Simple consistency metric based on message length variance
    const lengths = commits.map(c => c.message.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    return Math.max(0, 100 - (stdDev / avg) * 100);
  }

  generateWeekRange(commits) {
    if (commits.length === 0) return [];
    
    const dates = commits.map(c => moment(c.date)).sort((a, b) => a - b);
    const start = dates[0].startOf('week');
    const end = dates[dates.length - 1].endOf('week');
    const weeks = [];
    
    for (let week = start.clone(); week.isSameOrBefore(end); week.add(1, 'week')) {
      weeks.push(week.format('YYYY-[W]WW'));
    }
    
    return weeks;
  }

  analyzeWorkingPatterns(commits) {
    const hourCounts = {};
    const dayCounts = {};
    
    commits.forEach(commit => {
      const date = moment(commit.date);
      const hour = date.hour();
      const day = date.day();
      
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    
    return {
      preferredHours: Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: parseInt(hour), count })),
      workingDays: Object.entries(dayCounts)
        .filter(([, count]) => count > 0)
        .map(([day, count]) => ({ day: parseInt(day), count }))
    };
  }

  // Health calculation methods
  calculateFrequencyHealth(commits) {
    const daysSinceLastCommit = moment().diff(moment(commits[0].date), 'days');
    if (daysSinceLastCommit <= 1) return 100;
    if (daysSinceLastCommit <= 7) return 80;
    if (daysSinceLastCommit <= 30) return 60;
    if (daysSinceLastCommit <= 90) return 40;
    return 20;
  }

  calculateMessageQualityHealth(commits) {
    const messageStats = this.calculateMessageStats(commits);
    let score = 0;
    
    // Length score
    if (messageStats.averageLength >= 20 && messageStats.averageLength <= 72) {
      score += 40;
    } else {
      score += 20;
    }
    
    // Convention score
    score += messageStats.conventions.conventionalCommits * 0.6;
    
    return Math.min(100, score);
  }

  calculateAuthorDiversityHealth(commits) {
    const authors = new Set(commits.map(c => c.author));
    const diversity = authors.size;
    
    if (diversity === 1) return 60; // Solo project
    if (diversity <= 3) return 80;
    if (diversity <= 10) return 100;
    return 90; // Very large team might have coordination challenges
  }

  calculateConsistencyHealth(commits) {
    const consistency = this.calculateMessageConsistency(commits);
    return Math.round(consistency);
  }

  calculateRecencyHealth(commits) {
    const daysSinceLastCommit = moment().diff(moment(commits[0].date), 'days');
    if (daysSinceLastCommit <= 7) return 100;
    if (daysSinceLastCommit <= 30) return 80;
    if (daysSinceLastCommit <= 90) return 60;
    return 40;
  }

  generateHealthRecommendations(factors, score) {
    const recommendations = [];
    
    if (factors.frequency < 70) {
      recommendations.push('Increase commit frequency for better project momentum');
    }
    
    if (factors.messageQuality < 70) {
      recommendations.push('Improve commit message quality and follow conventional commit format');
    }
    
    if (factors.consistency < 70) {
      recommendations.push('Maintain more consistent commit message formatting');
    }
    
    if (score < 60) {
      recommendations.push('Consider establishing commit guidelines for the team');
    }
    
    return recommendations;
  }

  getHealthGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Trend calculation methods
  getMonthlyTrends(commits) {
    const monthlyData = {};
    
    commits.forEach(commit => {
      const month = moment(commit.date).format('YYYY-MM');
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    
    return monthlyData;
  }

  calculateVelocity(monthlyData) {
    const months = Object.keys(monthlyData).sort();
    if (months.length < 2) return 0;
    
    const recent = months.slice(-3);
    const older = months.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, month) => sum + monthlyData[month], 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, month) => sum + monthlyData[month], 0) / older.length : recentAvg;
    
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  calculateMomentum(monthlyData) {
    const months = Object.keys(monthlyData).sort();
    if (months.length < 3) return 'neutral';
    
    const lastThree = months.slice(-3).map(month => monthlyData[month]);
    const trend = lastThree[2] - lastThree[0];
    
    if (trend > 0) return 'increasing';
    if (trend < 0) return 'decreasing';
    return 'stable';
  }

  classifyActivity(velocity, momentum) {
    if (velocity > 20 && momentum === 'increasing') return 'accelerating';
    if (velocity > 0 && momentum === 'increasing') return 'growing';
    if (velocity < -20 && momentum === 'decreasing') return 'declining';
    if (velocity < 0 && momentum === 'decreasing') return 'slowing';
    return 'stable';
  }

  generatePredictions(monthlyData) {
    const months = Object.keys(monthlyData).sort();
    if (months.length < 3) return {};
    
    const recent = months.slice(-3).map(month => monthlyData[month]);
    const trend = (recent[2] - recent[0]) / 2;
    const nextMonth = recent[2] + trend;
    
    return {
      nextMonth: Math.max(0, Math.round(nextMonth)),
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      confidence: months.length >= 6 ? 'high' : months.length >= 3 ? 'medium' : 'low'
    };
  }

  generateCommitSuggestions(analysis, totalCommits) {
    const suggestions = [];
    
    const conventionalPercentage = (analysis.patterns.conventional / totalCommits) * 100;
    if (conventionalPercentage < 50) {
      suggestions.push({
        type: 'convention',
        priority: 'high',
        message: 'Consider adopting conventional commit format for better consistency',
        example: 'feat(auth): add user authentication system'
      });
    }
    
    const vaguePercentage = (analysis.patterns.vague / totalCommits) * 100;
    if (vaguePercentage > 20) {
      suggestions.push({
        type: 'clarity',
        priority: 'medium',
        message: 'Reduce vague commit messages for better project history',
        example: 'Instead of "fix bug", use "fix memory leak in user session handler"'
      });
    }
    
    if (analysis.issues.length > totalCommits * 0.3) {
      suggestions.push({
        type: 'formatting',
        priority: 'low',
        message: 'Improve commit message formatting consistency',
        example: 'Keep first line under 72 characters and capitalize properly'
      });
    }
    
    return suggestions;
  }
}

module.exports = CommitAnalyzer;