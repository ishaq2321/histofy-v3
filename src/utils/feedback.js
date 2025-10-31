/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * User feedback and interaction utilities
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { ProgressUtils } = require('./progress');

/**
 * User feedback and interaction utilities
 */
class FeedbackUtils {

    /**
     * Display operation summary with statistics
     * @param {string} operation - Operation name
     * @param {Object} stats - Operation statistics
     * @param {number} duration - Operation duration in milliseconds
     */
    static displayOperationSummary(operation, stats = {}, duration = null) {
        console.log(chalk.blue(`\n${operation} Summary:`));

        // Display duration if provided
        if (duration !== null) {
            const seconds = Math.round(duration / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;

            const durationStr = minutes > 0
                ? `${minutes}m ${remainingSeconds}s`
                : `${seconds}s`;

            console.log(chalk.gray(`   Duration: ${durationStr}`));
        }

        // Display statistics
        Object.entries(stats).forEach(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            console.log(chalk.gray(`   ${formattedKey}: ${value}`));
        });

        console.log();
    }

    /**
     * Display a success message with optional details
     * @param {string} message - Success message
     * @param {Array} details - Optional array of detail strings
     */
    static displaySuccess(message, details = []) {
        console.log(chalk.green(`✓ ${message}`));

        if (details.length > 0) {
            details.forEach(detail => {
                console.log(chalk.gray(`   ${detail}`));
            });
        }

        console.log();
    }

    /**
     * Display a warning message with optional suggestions
     * @param {string} message - Warning message
     * @param {Array} suggestions - Optional array of suggestion strings
     */
    static displayWarning(message, suggestions = []) {
        console.log(chalk.yellow(`⚠ ${message}`));

        if (suggestions.length > 0) {
            console.log(chalk.yellow('   Suggestions:'));
            suggestions.forEach((suggestion, index) => {
                console.log(chalk.gray(`   ${index + 1}. ${suggestion}`));
            });
        }

        console.log();
    }

    /**
     * Display an info message with optional context
     * @param {string} message - Info message
     * @param {Array} context - Optional array of context strings
     */
    static displayInfo(message, context = []) {
        console.log(chalk.blue(`ℹ ${message}`));

        if (context.length > 0) {
            context.forEach(item => {
                console.log(chalk.gray(`   ${item}`));
            });
        }

        console.log();
    }

    /**
     * Confirm a potentially destructive operation
     * @param {string} operation - Operation description
     * @param {Array} warnings - Array of warning messages
     * @param {Object} options - Confirmation options
     * @returns {Promise<boolean>} User confirmation
     */
    static async confirmDestructiveOperation(operation, warnings = [], options = {}) {
        const {
            confirmText = 'yes',
            cancelText = 'no',
            defaultValue = false
        } = options;

        console.log(chalk.red(`⚠ Destructive Operation: ${operation}`));

        if (warnings.length > 0) {
            console.log(chalk.yellow('   Warnings:'));
            warnings.forEach((warning, index) => {
                console.log(chalk.yellow(`   ${index + 1}. ${warning}`));
            });
        }

        console.log();

        const response = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: `Are you sure you want to proceed with ${operation}?`,
                default: defaultValue
            }
        ]);

        return response.confirmed;
    }

    /**
     * Get user choice from multiple options
     * @param {string} question - Question to ask
     * @param {Array} choices - Array of choice objects or strings
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Selected choice
     */
    static async getUserChoice(question, choices, options = {}) {
        const {
            defaultChoice = null,
            allowCancel = false
        } = options;

        const formattedChoices = choices.map(choice => {
            if (typeof choice === 'string') {
                return { name: choice, value: choice };
            }
            return choice;
        });

        if (allowCancel) {
            formattedChoices.push({ name: 'Cancel', value: null });
        }

        const response = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: question,
                choices: formattedChoices,
                default: defaultChoice
            }
        ]);

        return response.choice;
    }

    /**
     * Get multiple selections from user
     * @param {string} question - Question to ask
     * @param {Array} choices - Array of choice objects or strings
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Selected choices
     */
    static async getMultipleChoices(question, choices, options = {}) {
        const {
            defaultChoices = [],
            minSelections = 0,
            maxSelections = null
        } = options;

        const response = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'choices',
                message: question,
                choices: choices,
                default: defaultChoices,
                validate: (selections) => {
                    if (selections.length < minSelections) {
                        return `Please select at least ${minSelections} option(s)`;
                    }
                    if (maxSelections && selections.length > maxSelections) {
                        return `Please select no more than ${maxSelections} option(s)`;
                    }
                    return true;
                }
            }
        ]);

        return response.choices;
    }

    /**
     * Display a table of data with formatting
     * @param {Array} data - Array of objects to display
     * @param {Array} columns - Column definitions
     * @param {Object} options - Table options
     */
    static displayTable(data, columns, options = {}) {
        const Table = require('cli-table3');

        const {
            title = null,
            maxWidth = 80,
            style = { head: ['cyan'] }
        } = options;

        if (title) {
            console.log(chalk.blue(title));
        }

        if (data.length === 0) {
            console.log(chalk.gray('   No data to display'));
            console.log();
            return;
        }

        const table = new Table({
            head: columns.map(col => col.header || col.key),
            style: style,
            colWidths: columns.map(col => col.width || Math.floor(maxWidth / columns.length))
        });

        data.forEach(row => {
            const tableRow = columns.map(col => {
                let value = row[col.key];

                // Apply formatter if provided
                if (col.formatter && typeof col.formatter === 'function') {
                    value = col.formatter(value, row);
                }

                // Apply color if provided
                if (col.color) {
                    value = chalk[col.color](value);
                }

                return value || '';
            });

            table.push(tableRow);
        });

        console.log(table.toString());
        console.log();
    }

    /**
     * Display a progress summary for completed operations
     * @param {Array} operations - Array of operation objects
     */
    static displayProgressSummary(operations) {
        console.log(chalk.blue('Operation Summary:'));

        let totalDuration = 0;
        let successCount = 0;
        let failureCount = 0;
        let warningCount = 0;

        operations.forEach((op, index) => {
            const status = op.success ? '✓' : op.warning ? '⚠' : '✗';
            const color = op.success ? 'green' : op.warning ? 'yellow' : 'red';

            console.log(chalk[color](`   ${status} ${op.name}`));

            if (op.duration) {
                totalDuration += op.duration;
                const seconds = Math.round(op.duration / 1000);
                console.log(chalk.gray(`     Duration: ${seconds}s`));
            }

            if (op.details) {
                console.log(chalk.gray(`     ${op.details}`));
            }

            if (op.success) successCount++;
            else if (op.warning) warningCount++;
            else failureCount++;
        });

        console.log();
        console.log(chalk.blue('Summary Statistics:'));
        console.log(chalk.green(`   Successful: ${successCount}`));
        if (warningCount > 0) {
            console.log(chalk.yellow(`   Warnings: ${warningCount}`));
        }
        if (failureCount > 0) {
            console.log(chalk.red(`   Failed: ${failureCount}`));
        }

        if (totalDuration > 0) {
            const totalSeconds = Math.round(totalDuration / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            console.log(chalk.gray(`   Total Duration: ${durationStr}`));
        }

        console.log();
    }

    /**
     * Create an interactive progress monitor for long operations
     * @param {string} title - Progress monitor title
     * @param {Array} steps - Array of step definitions
     * @returns {Object} Progress monitor object
     */
    static createProgressMonitor(title, steps = []) {
        const monitor = {
            title,
            steps: steps.map((step, index) => ({
                id: index,
                name: step.name || `Step ${index + 1}`,
                description: step.description || '',
                status: 'pending',
                startTime: null,
                endTime: null,
                progress: 0
            })),
            currentStep: 0,
            startTime: Date.now(),

            start() {
                console.log(chalk.blue(`\n${this.title}`));
                console.log(chalk.gray(`Starting ${this.steps.length} step process...\n`));
                this.render();
                return this;
            },

            startStep(stepIndex, description = null) {
                if (stepIndex >= this.steps.length) return this;

                const step = this.steps[stepIndex];
                step.status = 'running';
                step.startTime = Date.now();
                if (description) step.description = description;

                this.currentStep = stepIndex;
                this.render();
                return this;
            },

            updateStep(stepIndex, progress, description = null) {
                if (stepIndex >= this.steps.length) return this;

                const step = this.steps[stepIndex];
                step.progress = Math.min(Math.max(progress, 0), 100);
                if (description) step.description = description;

                this.render();
                return this;
            },

            completeStep(stepIndex, description = null) {
                if (stepIndex >= this.steps.length) return this;

                const step = this.steps[stepIndex];
                step.status = 'completed';
                step.endTime = Date.now();
                step.progress = 100;
                if (description) step.description = description;

                this.render();
                return this;
            },

            failStep(stepIndex, error = null, description = null) {
                if (stepIndex >= this.steps.length) return this;

                const step = this.steps[stepIndex];
                step.status = 'failed';
                step.endTime = Date.now();
                step.error = error;
                if (description) step.description = description;

                this.render();
                return this;
            },

            render() {
                // Clear previous output and render current state
                process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen

                console.log(chalk.blue(`${this.title}\n`));

                this.steps.forEach((step, index) => {
                    const icon = this.getStepIcon(step.status);
                    const name = chalk.bold(step.name);
                    const description = step.description ? ` - ${step.description}` : '';

                    console.log(`${icon} ${name}${description}`);

                    if (step.status === 'running' && step.progress > 0) {
                        const progressBar = this.createProgressBar(step.progress);
                        console.log(`    ${progressBar}`);
                    }

                    if (step.error) {
                        console.log(chalk.red(`    Error: ${step.error.message}`));
                    }
                });

                console.log();
            },

            getStepIcon(status) {
                switch (status) {
                    case 'pending': return chalk.gray('○');
                    case 'running': return chalk.blue('●');
                    case 'completed': return chalk.green('✓');
                    case 'failed': return chalk.red('✗');
                    default: return chalk.gray('○');
                }
            },

            createProgressBar(progress) {
                const width = 30;
                const filled = Math.round((progress / 100) * width);
                const empty = width - filled;

                return `[${chalk.cyan('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}] ${progress}%`;
            },

            complete() {
                const duration = Date.now() - this.startTime;
                const completed = this.steps.filter(s => s.status === 'completed').length;
                const failed = this.steps.filter(s => s.status === 'failed').length;

                console.log(chalk.green(`\n${this.title} completed!`));
                console.log(chalk.gray(`   Steps completed: ${completed}/${this.steps.length}`));
                if (failed > 0) {
                    console.log(chalk.red(`   Steps failed: ${failed}`));
                }
                console.log(chalk.gray(`   Total duration: ${Math.round(duration / 1000)}s\n`));

                return this;
            }
        };

        return monitor;
    }
}

module.exports = FeedbackUtils;