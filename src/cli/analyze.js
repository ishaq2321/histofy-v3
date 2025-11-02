/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Analyze CLI - Commit history analysis and statistics
 */

const { Command } = require('commander');
const CommitAnalyzer = require('../utils/CommitAnalyzer');
const { ProgressUtils } = require('../utils/progress');
const { FeedbackUtils } = require('../utils/feedback');
const ValidationUtils = require('../utils/ValidationUtils');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

const analyzeCommand = new Command('analyze');

analyzeCommand
  .description('Analyze commit history and generate comprehensive statistics')
  .option('-s, --since <date>', 'Analyze commits since date (YYYY-MM-DD)')
  .option('-u, --until <date>', 'Analyze commits until date (YYYY-MM-DD)')
  .option('-a, --author <author>', 'Filter by author')
  .option('-b, --branch <branch>', 'Analyze specific branch')
  .option('--max-commits <number>', 'Maximum commits to analyze', '1000')
  .option('--include-files', 'Include file change statistics')
  .option('--include-diffs', 'Include diff statistics')
  .option('--output <file>', 'Save analysis to file')
  .option('--format <format>', 'Output format (json|csv|html)', 'json')
  .option('--heatmap', 'Generate activity heatmap')
  .option('--patterns', 'Analyze commit message patterns')
  .option('--health', 'Generate repository health report')
  .option('--trends', 'Analyze commit trends and predictions')
  .option('--interactive', 'Interactive analysis mode')
  .action(async (options) => {
    try {
      await handleAnalyzeCommand(options);
    } catch (error) {
      FeedbackUtils.error('Analysis failed', error.message);
      process.exit(1);
    }
  });

// Subcommands
analyzeCommand
  .command('stats')
  .description('Generate comprehensive commit statistics')
  .option('-s, --since <date>', 'Analyze commits since date')
  .option('-u, --until <date>', 'Analyze commits until date')
  .option('-a, --author <author>', 'Filter by author')
  .option('--output <file>', 'Save statistics to file')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      await handleStatsCommand(options);
    } catch (error) {
      FeedbackUtils.error('Statistics generation failed', error.message);
      process.exit(1);
    }
  });

analyzeCommand
  .command('heatmap')
  .description('Generate commit activity heatmap')
  .option('-s, --since <date>', 'Start date for heatmap (default: 1 year ago)')
  .option('-u, --until <date>', 'End date for heatmap (default: today)')
  .option('-a, --author <author>', 'Filter by author')
  .option('--output <file>', 'Save heatmap data to file')
  .option('--format <format>', 'Output format (json|csv)', 'json')
  .action(async (options) => {
    try {
      await handleHeatmapCommand(options);
    } catch (error) {
      FeedbackUtils.error('Heatmap generation failed', error.message);
      process.exit(1);
    }
  });

analyzeCommand
  .command('patterns')
  .description('Analyze commit message patterns and suggest improvements')
  .option('-s, --since <date>', 'Analyze commits since date')
  .option('-u, --until <date>', 'Analyze commits until date')
  .option('-a, --author <author>', 'Filter by author')
  .option('--output <file>', 'Save pattern analysis to file')
  .option('--suggestions', 'Include improvement suggestions')
  .action(async (options) => {
    try {
      await handlePatternsCommand(options);
    } catch (error) {
      FeedbackUtils.error('Pattern analysis failed', error.message);
      process.exit(1);
    }
  });

analyzeCommand
  .command('health')
  .description('Generate repository health report')
  .option('-s, --since <date>', 'Analyze commits since date')
  .option('-u, --until <date>', 'Analyze commits until date')
  .option('--output <file>', 'Save health report to file')
  .option('--detailed', 'Include detailed recommendations')
  .action(async (options) => {
    try {
      await handleHealthCommand(options);
    } catch (error) {
      FeedbackUtils.error('Health analysis failed', error.message);
      process.exit(1);
    }
  });

analyzeCommand
  .command('trends')
  .description('Analyze commit trends and generate predictions')
  .option('-s, --since <date>', 'Analyze commits since date')
  .option('-u, --until <date>', 'Analyze commits until date')
  .option('--output <file>', 'Save trend analysis to file')
  .option('--predictions', 'Include future predictions')
  .action(async (options) => {
    try {
      await handleTrendsCommand(options);
    } catch (error) {
      FeedbackUtils.error('Trend analysis failed', error.message);
      process.exit(1);
    }
  });

/**
 * Handle main analyze command
 */
async function handleAnalyzeCommand(options) {
  const analyzer = new CommitAnalyzer();\n\n  // Validate options\n  const analysisOptions = await validateAndPrepareOptions(options);\n\n  if (options.interactive) {\n    return await runInteractiveAnalysis(analyzer, analysisOptions);\n  }\n\n  // Run comprehensive analysis\n  const results = await analyzer.getComprehensiveStats(analysisOptions);\n\n  // Generate specific analyses based on flags\n  if (options.heatmap) {\n    results.heatmap = await analyzer.generateHeatmap(analysisOptions);\n  }\n\n  if (options.patterns) {\n    const commits = await analyzer.gitManager.getCommitHistory(analysisOptions);\n    results.patterns = analyzer.analyzeCommitPatterns(commits);\n  }\n\n  // Display results\n  await displayAnalysisResults(results, options);\n\n  // Save to file if requested\n  if (options.output) {\n    await saveAnalysisResults(results, options.output, options.format);\n    FeedbackUtils.success(`Analysis saved to ${options.output}`);\n  }\n}\n\n/**\n * Handle stats subcommand\n */\nasync function handleStatsCommand(options) {\n  const analyzer = new CommitAnalyzer();\n  const analysisOptions = await validateAndPrepareOptions(options);\n\n  const progress = ProgressUtils.spinner('Generating statistics...');\n  progress.start();\n\n  try {\n    const stats = await analyzer.getComprehensiveStats(analysisOptions);\n    progress.succeed('Statistics generated');\n\n    if (options.format === 'table') {\n      displayStatsTable(stats);\n    } else {\n      console.log(JSON.stringify(stats, null, 2));\n    }\n\n    if (options.output) {\n      await saveAnalysisResults(stats, options.output, options.format);\n      FeedbackUtils.success(`Statistics saved to ${options.output}`);\n    }\n  } catch (error) {\n    progress.fail('Statistics generation failed');\n    throw error;\n  }\n}\n\n/**\n * Handle heatmap subcommand\n */\nasync function handleHeatmapCommand(options) {\n  const analyzer = new CommitAnalyzer();\n  \n  const heatmapOptions = {\n    since: options.since ? new Date(options.since) : moment().subtract(1, 'year').toDate(),\n    until: options.until ? new Date(options.until) : new Date(),\n    author: options.author\n  };\n\n  const progress = ProgressUtils.spinner('Generating heatmap...');\n  progress.start();\n\n  try {\n    const heatmap = await analyzer.generateHeatmap(heatmapOptions);\n    progress.succeed('Heatmap generated');\n\n    displayHeatmapSummary(heatmap);\n\n    if (options.output) {\n      await saveAnalysisResults(heatmap, options.output, options.format);\n      FeedbackUtils.success(`Heatmap data saved to ${options.output}`);\n    }\n  } catch (error) {\n    progress.fail('Heatmap generation failed');\n    throw error;\n  }\n}\n\n/**\n * Handle patterns subcommand\n */\nasync function handlePatternsCommand(options) {\n  const analyzer = new CommitAnalyzer();\n  const analysisOptions = await validateAndPrepareOptions(options);\n\n  const progress = ProgressUtils.spinner('Analyzing commit patterns...');\n  progress.start();\n\n  try {\n    const commits = await analyzer.gitManager.getCommitHistory(analysisOptions);\n    const patterns = analyzer.analyzeCommitPatterns(commits);\n    progress.succeed('Pattern analysis completed');\n\n    displayPatternAnalysis(patterns, options.suggestions);\n\n    if (options.output) {\n      await saveAnalysisResults(patterns, options.output, 'json');\n      FeedbackUtils.success(`Pattern analysis saved to ${options.output}`);\n    }\n  } catch (error) {\n    progress.fail('Pattern analysis failed');\n    throw error;\n  }\n}\n\n/**\n * Handle health subcommand\n */\nasync function handleHealthCommand(options) {\n  const analyzer = new CommitAnalyzer();\n  const analysisOptions = await validateAndPrepareOptions(options);\n\n  const progress = ProgressUtils.spinner('Analyzing repository health...');\n  progress.start();\n\n  try {\n    const stats = await analyzer.getComprehensiveStats(analysisOptions);\n    const health = stats.health;\n    progress.succeed('Health analysis completed');\n\n    displayHealthReport(health, options.detailed);\n\n    if (options.output) {\n      await saveAnalysisResults(health, options.output, 'json');\n      FeedbackUtils.success(`Health report saved to ${options.output}`);\n    }\n  } catch (error) {\n    progress.fail('Health analysis failed');\n    throw error;\n  }\n}\n\n/**\n * Handle trends subcommand\n */\nasync function handleTrendsCommand(options) {\n  const analyzer = new CommitAnalyzer();\n  const analysisOptions = await validateAndPrepareOptions(options);\n\n  const progress = ProgressUtils.spinner('Analyzing trends...');\n  progress.start();\n\n  try {\n    const stats = await analyzer.getComprehensiveStats(analysisOptions);\n    const trends = stats.trends;\n    progress.succeed('Trend analysis completed');\n\n    displayTrendAnalysis(trends, options.predictions);\n\n    if (options.output) {\n      await saveAnalysisResults(trends, options.output, 'json');\n      FeedbackUtils.success(`Trend analysis saved to ${options.output}`);\n    }\n  } catch (error) {\n    progress.fail('Trend analysis failed');\n    throw error;\n  }\n}\n\n/**\n * Validate and prepare analysis options\n */\nasync function validateAndPrepareOptions(options) {\n  const analysisOptions = {\n    maxCommits: parseInt(options.maxCommits) || 1000,\n    includeFiles: options.includeFiles || false,\n    includeDiffs: options.includeDiffs || false\n  };\n\n  // Validate and set date range\n  if (options.since) {\n    if (!ValidationUtils.isValidDate(options.since)) {\n      throw new Error('Invalid since date format. Use YYYY-MM-DD');\n    }\n    analysisOptions.since = options.since;\n  }\n\n  if (options.until) {\n    if (!ValidationUtils.isValidDate(options.until)) {\n      throw new Error('Invalid until date format. Use YYYY-MM-DD');\n    }\n    analysisOptions.until = options.until;\n  }\n\n  // Validate date range\n  if (options.since && options.until) {\n    const sinceDate = new Date(options.since);\n    const untilDate = new Date(options.until);\n    if (sinceDate >= untilDate) {\n      throw new Error('Since date must be before until date');\n    }\n  }\n\n  // Set author filter\n  if (options.author) {\n    analysisOptions.author = options.author;\n  }\n\n  // Set branch filter\n  if (options.branch) {\n    analysisOptions.branch = options.branch;\n  }\n\n  return analysisOptions;\n}\n\n/**\n * Run interactive analysis mode\n */\nasync function runInteractiveAnalysis(analyzer, baseOptions) {\n  const inquirer = require('inquirer');\n\n  console.log('\\n🔍 Interactive Commit Analysis\\n');\n\n  const answers = await inquirer.prompt([\n    {\n      type: 'checkbox',\n      name: 'analyses',\n      message: 'Select analyses to run:',\n      choices: [\n        { name: 'Comprehensive Statistics', value: 'stats' },\n        { name: 'Activity Heatmap', value: 'heatmap' },\n        { name: 'Commit Patterns', value: 'patterns' },\n        { name: 'Repository Health', value: 'health' },\n        { name: 'Trend Analysis', value: 'trends' }\n      ],\n      default: ['stats']\n    },\n    {\n      type: 'input',\n      name: 'author',\n      message: 'Filter by author (optional):',\n      when: () => !baseOptions.author\n    },\n    {\n      type: 'input',\n      name: 'since',\n      message: 'Analyze since date (YYYY-MM-DD, optional):',\n      when: () => !baseOptions.since,\n      validate: (input) => {\n        if (!input) return true;\n        return ValidationUtils.isValidDate(input) || 'Invalid date format';\n      }\n    },\n    {\n      type: 'confirm',\n      name: 'saveResults',\n      message: 'Save results to file?',\n      default: false\n    },\n    {\n      type: 'input',\n      name: 'outputFile',\n      message: 'Output file path:',\n      when: (answers) => answers.saveResults,\n      default: `analysis-${moment().format('YYYY-MM-DD')}.json`\n    }\n  ]);\n\n  // Merge options\n  const options = {\n    ...baseOptions,\n    author: answers.author || baseOptions.author,\n    since: answers.since || baseOptions.since\n  };\n\n  const results = {};\n\n  // Run selected analyses\n  for (const analysis of answers.analyses) {\n    const progress = ProgressUtils.spinner(`Running ${analysis} analysis...`);\n    progress.start();\n\n    try {\n      switch (analysis) {\n        case 'stats':\n          results.stats = await analyzer.getComprehensiveStats(options);\n          break;\n        case 'heatmap':\n          results.heatmap = await analyzer.generateHeatmap(options);\n          break;\n        case 'patterns':\n          const commits = await analyzer.gitManager.getCommitHistory(options);\n          results.patterns = analyzer.analyzeCommitPatterns(commits);\n          break;\n        case 'health':\n          if (!results.stats) {\n            results.stats = await analyzer.getComprehensiveStats(options);\n          }\n          results.health = results.stats.health;\n          break;\n        case 'trends':\n          if (!results.stats) {\n            results.stats = await analyzer.getComprehensiveStats(options);\n          }\n          results.trends = results.stats.trends;\n          break;\n      }\n      progress.succeed(`${analysis} analysis completed`);\n    } catch (error) {\n      progress.fail(`${analysis} analysis failed`);\n      throw error;\n    }\n  }\n\n  // Display results\n  console.log('\\n📊 Analysis Results\\n');\n  await displayAnalysisResults(results, { format: 'table' });\n\n  // Save results if requested\n  if (answers.saveResults) {\n    await saveAnalysisResults(results, answers.outputFile, 'json');\n    FeedbackUtils.success(`Results saved to ${answers.outputFile}`);\n  }\n}\n\n/**\n * Display analysis results\n */\nasync function displayAnalysisResults(results, options) {\n  if (results.stats) {\n    displayStatsTable(results.stats);\n  }\n\n  if (results.heatmap) {\n    displayHeatmapSummary(results.heatmap);\n  }\n\n  if (results.patterns) {\n    displayPatternAnalysis(results.patterns, true);\n  }\n\n  if (results.health) {\n    displayHealthReport(results.health, true);\n  }\n\n  if (results.trends) {\n    displayTrendAnalysis(results.trends, true);\n  }\n}\n\n/**\n * Display statistics in table format\n */\nfunction displayStatsTable(stats) {\n  const Table = require('cli-table3');\n\n  console.log('\\n📈 Repository Overview\\n');\n  \n  const overviewTable = new Table({\n    head: ['Metric', 'Value'],\n    colWidths: [25, 20]\n  });\n\n  overviewTable.push(\n    ['Total Commits', stats.overview.totalCommits],\n    ['Unique Authors', stats.overview.uniqueAuthors],\n    ['Repository Age (days)', stats.overview.repositoryAge],\n    ['Avg Commits/Day', stats.overview.averageCommitsPerDay]\n  );\n\n  console.log(overviewTable.toString());\n\n  // Top authors\n  if (stats.authors.topAuthors.length > 0) {\n    console.log('\\n👥 Top Contributors\\n');\n    \n    const authorsTable = new Table({\n      head: ['Author', 'Commits', 'Percentage', 'Active Days'],\n      colWidths: [25, 10, 12, 12]\n    });\n\n    stats.authors.topAuthors.slice(0, 5).forEach(author => {\n      authorsTable.push([\n        author.author,\n        author.commits,\n        `${author.percentage}%`,\n        author.activeDays\n      ]);\n    });\n\n    console.log(authorsTable.toString());\n  }\n\n  // Temporal patterns\n  console.log('\\n⏰ Activity Patterns\\n');\n  \n  const temporalTable = new Table({\n    head: ['Pattern', 'Value'],\n    colWidths: [25, 30]\n  });\n\n  temporalTable.push(\n    ['Peak Hour', `${stats.temporal.peakHour}:00`],\n    ['Most Active Day', getDayName(stats.temporal.peakDay)]\n  );\n\n  if (stats.temporal.patterns.length > 0) {\n    stats.temporal.patterns.forEach(pattern => {\n      temporalTable.push([pattern.type, pattern.description]);\n    });\n  }\n\n  console.log(temporalTable.toString());\n\n  // Health score\n  if (stats.health) {\n    console.log('\\n🏥 Repository Health\\n');\n    \n    const healthTable = new Table({\n      head: ['Factor', 'Score', 'Grade'],\n      colWidths: [20, 10, 8]\n    });\n\n    healthTable.push(\n      ['Overall Score', stats.health.score, stats.health.grade],\n      ['Frequency', Math.round(stats.health.factors.frequency), ''],\n      ['Message Quality', Math.round(stats.health.factors.messageQuality), ''],\n      ['Consistency', Math.round(stats.health.factors.consistency), '']\n    );\n\n    console.log(healthTable.toString());\n  }\n}\n\n/**\n * Display heatmap summary\n */\nfunction displayHeatmapSummary(heatmap) {\n  console.log('\\n🔥 Activity Heatmap Summary\\n');\n  \n  const Table = require('cli-table3');\n  const table = new Table({\n    head: ['Metric', 'Value'],\n    colWidths: [25, 15]\n  });\n\n  table.push(\n    ['Total Days', heatmap.summary.totalDays],\n    ['Active Days', heatmap.summary.activeDays],\n    ['Total Commits', heatmap.summary.totalCommits],\n    ['Max Commits/Day', heatmap.summary.maxCommitsPerDay],\n    ['Avg Commits/Day', heatmap.summary.averageCommitsPerDay]\n  );\n\n  console.log(table.toString());\n\n  const activityRate = Math.round((heatmap.summary.activeDays / heatmap.summary.totalDays) * 100);\n  console.log(`\\n📊 Activity Rate: ${activityRate}%`);\n}\n\n/**\n * Display pattern analysis\n */\nfunction displayPatternAnalysis(patterns, includeSuggestions = false) {\n  console.log('\\n📝 Commit Message Patterns\\n');\n  \n  const Table = require('cli-table3');\n  const patternsTable = new Table({\n    head: ['Pattern Type', 'Count', 'Percentage'],\n    colWidths: [20, 10, 12]\n  });\n\n  const total = Object.values(patterns.patterns).reduce((a, b) => a + b, 0);\n  \n  Object.entries(patterns.patterns).forEach(([type, count]) => {\n    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;\n    patternsTable.push([type, count, `${percentage}%`]);\n  });\n\n  console.log(patternsTable.toString());\n\n  if (patterns.issues.length > 0) {\n    console.log(`\\n⚠️  Found ${patterns.issues.length} message formatting issues`);\n  }\n\n  if (includeSuggestions && patterns.suggestions.length > 0) {\n    console.log('\\n💡 Suggestions for Improvement\\n');\n    \n    patterns.suggestions.forEach((suggestion, index) => {\n      console.log(`${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.message}`);\n      if (suggestion.example) {\n        console.log(`   Example: ${suggestion.example}`);\n      }\n      console.log('');\n    });\n  }\n}\n\n/**\n * Display health report\n */\nfunction displayHealthReport(health, detailed = false) {\n  console.log('\\n🏥 Repository Health Report\\n');\n  \n  const scoreColor = health.score >= 80 ? '\\x1b[32m' : health.score >= 60 ? '\\x1b[33m' : '\\x1b[31m';\n  console.log(`Overall Health Score: ${scoreColor}${health.score}/100 (Grade: ${health.grade})\\x1b[0m\\n`);\n\n  const Table = require('cli-table3');\n  const factorsTable = new Table({\n    head: ['Health Factor', 'Score', 'Status'],\n    colWidths: [20, 10, 15]\n  });\n\n  Object.entries(health.factors).forEach(([factor, score]) => {\n    const status = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';\n    factorsTable.push([factor, Math.round(score), status]);\n  });\n\n  console.log(factorsTable.toString());\n\n  if (detailed && health.recommendations.length > 0) {\n    console.log('\\n📋 Recommendations\\n');\n    \n    health.recommendations.forEach((rec, index) => {\n      console.log(`${index + 1}. ${rec}`);\n    });\n    console.log('');\n  }\n}\n\n/**\n * Display trend analysis\n */\nfunction displayTrendAnalysis(trends, includePredictions = false) {\n  console.log('\\n📈 Commit Trends Analysis\\n');\n  \n  const Table = require('cli-table3');\n  const trendsTable = new Table({\n    head: ['Metric', 'Value'],\n    colWidths: [20, 25]\n  });\n\n  trendsTable.push(\n    ['Activity Status', trends.activity],\n    ['Velocity', `${Math.round(trends.velocity)}%`],\n    ['Momentum', trends.momentum]\n  );\n\n  console.log(trendsTable.toString());\n\n  if (includePredictions && trends.predictions) {\n    console.log('\\n🔮 Predictions\\n');\n    \n    const predictionsTable = new Table({\n      head: ['Prediction', 'Value', 'Confidence'],\n      colWidths: [20, 15, 12]\n    });\n\n    predictionsTable.push(\n      ['Next Month Commits', trends.predictions.nextMonth || 'N/A', trends.predictions.confidence || 'N/A'],\n      ['Trend Direction', trends.predictions.trend || 'N/A', '']\n    );\n\n    console.log(predictionsTable.toString());\n  }\n}\n\n/**\n * Save analysis results to file\n */\nasync function saveAnalysisResults(results, outputFile, format) {\n  const outputDir = path.dirname(outputFile);\n  await fs.mkdir(outputDir, { recursive: true });\n\n  let content;\n  \n  switch (format.toLowerCase()) {\n    case 'json':\n      content = JSON.stringify(results, null, 2);\n      break;\n    case 'csv':\n      content = convertToCSV(results);\n      break;\n    case 'html':\n      content = generateHTMLReport(results);\n      break;\n    default:\n      throw new Error(`Unsupported output format: ${format}`);\n  }\n\n  await fs.writeFile(outputFile, content, 'utf8');\n}\n\n/**\n * Convert results to CSV format\n */\nfunction convertToCSV(results) {\n  // Simple CSV conversion for overview stats\n  if (results.overview) {\n    const headers = ['Metric', 'Value'];\n    const rows = [\n      ['Total Commits', results.overview.totalCommits],\n      ['Unique Authors', results.overview.uniqueAuthors],\n      ['Repository Age', results.overview.repositoryAge],\n      ['Average Commits Per Day', results.overview.averageCommitsPerDay]\n    ];\n    \n    return [headers, ...rows].map(row => row.join(',')).join('\\n');\n  }\n  \n  return JSON.stringify(results, null, 2);\n}\n\n/**\n * Generate HTML report\n */\nfunction generateHTMLReport(results) {\n  return `\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Commit Analysis Report</title>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 20px; }\n        .metric { margin: 10px 0; }\n        .score { font-size: 24px; font-weight: bold; }\n        table { border-collapse: collapse; width: 100%; margin: 20px 0; }\n        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n        th { background-color: #f2f2f2; }\n    </style>\n</head>\n<body>\n    <h1>Commit Analysis Report</h1>\n    <div id=\"report-content\">\n        <pre>${JSON.stringify(results, null, 2)}</pre>\n    </div>\n    <p>Generated on: ${new Date().toISOString()}</p>\n</body>\n</html>\n  `;\n}\n\n/**\n * Helper function to get day name\n */\nfunction getDayName(dayIndex) {\n  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n  return days[dayIndex] || 'Unknown';\n}\n\nmodule.exports = analyzeCommand;