/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Progress indicators and user feedback utilities
 */

const ora = require('ora');
const chalk = require('chalk');
const { EventEmitter } = require('events');

/**
 * Enhanced progress indicator with cancellation support
 */
class ProgressIndicator extends EventEmitter {
    constructor(options = {}) {
        super();

        this.spinner = null;
        this.progressBar = null;
        this.startTime = null;
        this.cancelled = false;
        this.options = {
            type: 'spinner', // 'spinner', 'progress', 'steps'
            text: 'Processing...',
            color: 'cyan',
            spinner: 'dots',
            total: 100,
            showElapsed: true,
            showETA: true,
            ...options
        };
    }

    /**
     * Start the progress indicator
     * @param {string} text - Initial text to display
     */
    start(text = null) {
        if (this.cancelled) return;

        this.startTime = Date.now();
        const displayText = text || this.options.text;

        switch (this.options.type) {
            case 'spinner':
                this.spinner = ora({
                    text: displayText,
                    color: this.options.color,
                    spinner: this.options.spinner
                }).start();
                break;

            case 'progress':
                this.initProgressBar(displayText);
                break;

            case 'steps':
                this.initStepProgress(displayText);
                break;
        }

        // Set up cancellation handler
        this.setupCancellationHandler();

        return this;
    }

    /**
     * Update progress indicator
     * @param {string|number} value - New text or progress value
     * @param {string} text - Optional text update
     */
    update(value, text = null) {
        if (this.cancelled) return;

        switch (this.options.type) {
            case 'spinner':
                if (this.spinner) {
                    if (typeof value === 'string') {
                        this.spinner.text = value;
                    } else if (text) {
                        this.spinner.text = text;
                    }
                }
                break;

            case 'progress':
                this.updateProgressBar(value, text);
                break;

            case 'steps':
                this.updateStepProgress(value, text);
                break;
        }

        return this;
    }

    /**
     * Mark progress as successful and stop
     * @param {string} text - Success message
     */
    succeed(text = 'Completed successfully') {
        if (this.cancelled) return;

        const elapsed = this.getElapsedTime();
        const finalText = this.options.showElapsed ? `${text} (${elapsed})` : text;

        if (this.spinner) {
            this.spinner.succeed(finalText);
        } else {
            console.log(chalk.green(`✓ ${finalText}`));
        }

        this.cleanup();
        this.emit('success', { text: finalText, elapsed });
        return this;
    }

    /**
     * Mark progress as failed and stop
     * @param {string} text - Failure message
     */
    fail(text = 'Operation failed') {
        if (this.cancelled) return;

        const elapsed = this.getElapsedTime();
        const finalText = this.options.showElapsed ? `${text} (${elapsed})` : text;

        if (this.spinner) {
            this.spinner.fail(finalText);
        } else {
            console.log(chalk.red(`✗ ${finalText}`));
        }

        this.cleanup();
        this.emit('failure', { text: finalText, elapsed });
        return this;
    }

    /**
     * Stop progress indicator with warning
     * @param {string} text - Warning message
     */
    warn(text = 'Operation completed with warnings') {
        if (this.cancelled) return;

        const elapsed = this.getElapsedTime();
        const finalText = this.options.showElapsed ? `${text} (${elapsed})` : text;

        if (this.spinner) {
            this.spinner.warn(finalText);
        } else {
            console.log(chalk.yellow(`⚠ ${finalText}`));
        }

        this.cleanup();
        this.emit('warning', { text: finalText, elapsed });
        return this;
    }

    /**
     * Stop progress indicator with info
     * @param {string} text - Info message
     */
    info(text = 'Operation completed') {
        if (this.cancelled) return;

        const elapsed = this.getElapsedTime();
        const finalText = this.options.showElapsed ? `${text} (${elapsed})` : text;

        if (this.spinner) {
            this.spinner.info(finalText);
        } else {
            console.log(chalk.blue(`ℹ ${finalText}`));
        }

        this.cleanup();
        this.emit('info', { text: finalText, elapsed });
        return this;
    }

    /**
     * Cancel the progress indicator
     * @param {string} text - Cancellation message
     */
    cancel(text = 'Operation cancelled') {
        this.cancelled = true;

        if (this.spinner) {
            this.spinner.stop();
        }

        console.log(chalk.gray(`⊘ ${text}`));
        this.cleanup();
        this.emit('cancelled', { text });
        return this;
    }

    /**
     * Stop progress indicator without status
     */
    stop() {
        if (this.spinner) {
            this.spinner.stop();
        }

        this.cleanup();
        return this;
    }

    /**
     * Initialize progress bar
     * @param {string} text - Initial text
     */
    initProgressBar(text) {
        this.progressBar = {
            current: 0,
            total: this.options.total,
            text: text,
            width: 40
        };

        this.renderProgressBar();
    }

    /**
     * Update progress bar
     * @param {number} value - Progress value (0-100 or 0-total)
     * @param {string} text - Optional text update
     */
    updateProgressBar(value, text = null) {
        if (!this.progressBar) return;

        this.progressBar.current = Math.min(value, this.progressBar.total);
        if (text) {
            this.progressBar.text = text;
        }

        this.renderProgressBar();
    }

    /**
     * Render progress bar with enhanced information
     */
    renderProgressBar() {
        if (!this.progressBar || this.cancelled) return;

        const { current, total, text, width } = this.progressBar;
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * width);
        const empty = width - filled;

        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const elapsed = this.getElapsedTime();
        const eta = this.calculateETA(current, total);
        const memoryUsage = this.getMemoryUsage();

        let display = `${text} [${chalk.cyan(bar)}] ${percentage}%`;

        if (this.options.showElapsed) {
            display += ` | ${elapsed}`;
        }

        if (this.options.showETA && eta) {
            display += ` | ETA: ${eta}`;
        }

        if (this.options.showMemory && memoryUsage) {
            display += ` | Mem: ${memoryUsage}`;
        }

        // Add rate information
        const rate = this.calculateRate(current);
        if (rate && this.options.showRate) {
            display += ` | ${rate}/s`;
        }

        // Clear line and write new progress
        const terminalWidth = process.stdout.columns || 80;
        process.stdout.write('\r' + ' '.repeat(terminalWidth) + '\r');
        
        // Truncate display if too long
        if (display.length > terminalWidth - 5) {
            display = display.substring(0, terminalWidth - 8) + '...';
        }
        
        process.stdout.write(display);
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        try {
            const usage = process.memoryUsage();
            const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
            return `${heapUsed}MB`;
        } catch (error) {
            return null;
        }
    }

    /**
     * Calculate processing rate
     */
    calculateRate(current) {
        if (!this.startTime || current === 0) return null;

        const elapsed = (Date.now() - this.startTime) / 1000;
        if (elapsed < 1) return null;

        const rate = Math.round(current / elapsed);
        return rate > 0 ? rate : null;
    }

    /**
     * Initialize step progress
     * @param {string} text - Initial text
     */
    initStepProgress(text) {
        this.stepProgress = {
            current: 0,
            total: this.options.total,
            text: text,
            steps: []
        };
    }

    /**
     * Update step progress
     * @param {number} step - Current step number
     * @param {string} text - Step description
     */
    updateStepProgress(step, text) {
        if (!this.stepProgress) return;

        this.stepProgress.current = step;
        if (text) {
            this.stepProgress.text = text;
        }

        const { current, total } = this.stepProgress;
        const elapsed = this.getElapsedTime();

        const display = chalk.cyan(`[${current}/${total}]`) + ` ${text}`;

        if (this.options.showElapsed) {
            console.log(`${display} (${elapsed})`);
        } else {
            console.log(display);
        }
    }

    /**
     * Setup enhanced cancellation handler with confirmation
     */
    setupCancellationHandler() {
        const cancelHandler = async () => {
            if (this.cancelled) {
                // Force exit on second Ctrl+C
                console.log('\nForce exit...');
                process.exit(1);
                return;
            }

            // First Ctrl+C - ask for confirmation for destructive operations
            if (this.options.confirmCancel) {
                console.log('\n');
                const inquirer = require('inquirer');
                
                try {
                    const answer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Are you sure you want to cancel this operation?',
                        default: false
                    }]);

                    if (answer.confirm) {
                        this.cancel('Operation cancelled by user');
                        this.emit('cancelled', { confirmed: true });
                        
                        // Perform cleanup if provided
                        if (this.options.onCancel && typeof this.options.onCancel === 'function') {
                            await this.options.onCancel();
                        }
                        
                        process.exit(0);
                    } else {
                        // Resume operation
                        console.log('Continuing operation...');
                        this.renderProgressBar();
                    }
                } catch (error) {
                    // Fallback to immediate cancellation
                    this.cancel('Operation cancelled by user');
                    process.exit(1);
                }
            } else {
                // Immediate cancellation for non-destructive operations
                this.cancel('Operation cancelled by user');
                this.emit('cancelled', { confirmed: false });
                
                if (this.options.onCancel && typeof this.options.onCancel === 'function') {
                    try {
                        await this.options.onCancel();
                    } catch (error) {
                        console.error('Cleanup failed:', error.message);
                    }
                }
                
                process.exit(0);
            }
        };

        process.on('SIGINT', cancelHandler);
        process.on('SIGTERM', cancelHandler);

        // Store handler reference for cleanup
        this.cancelHandler = cancelHandler;
    }

    /**
     * Get elapsed time string
     * @returns {string} Formatted elapsed time
     */
    getElapsedTime() {
        if (!this.startTime) return '0s';

        const elapsed = Date.now() - this.startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }

        return `${seconds}s`;
    }

    /**
     * Calculate estimated time of arrival
     * @param {number} current - Current progress
     * @param {number} total - Total progress
     * @returns {string} Formatted ETA
     */
    calculateETA(current, total) {
        if (!this.startTime || current === 0) return null;

        const elapsed = Date.now() - this.startTime;
        const rate = current / elapsed;
        const remaining = total - current;
        const eta = remaining / rate;

        const etaSeconds = Math.floor(eta / 1000);
        const etaMinutes = Math.floor(etaSeconds / 60);

        if (etaMinutes > 0) {
            return `${etaMinutes}m ${etaSeconds % 60}s`;
        }

        return `${etaSeconds}s`;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.cancelHandler) {
            process.removeListener('SIGINT', this.cancelHandler);
            process.removeListener('SIGTERM', this.cancelHandler);
        }

        this.spinner = null;
        this.progressBar = null;
        this.stepProgress = null;
    }
}

/**
 * Enhanced multi-step progress manager with better tracking and cleanup
 */
class MultiStepProgress extends EventEmitter {
    constructor(steps = [], options = {}) {
        super();

        this.steps = steps.map((step, index) => ({
            id: index,
            name: step.name || `Step ${index + 1}`,
            description: step.description || '',
            status: 'pending', // 'pending', 'running', 'completed', 'failed', 'skipped', 'cancelled'
            progress: 0,
            startTime: null,
            endTime: null,
            error: null,
            memoryUsage: null,
            estimatedDuration: step.estimatedDuration || null
        }));

        this.currentStepIndex = 0;
        this.totalStartTime = null;
        this.cancelled = false;
        this.cleanupTasks = [];
        
        this.options = {
            showProgress: true,
            showElapsed: true,
            showMemory: false,
            showETA: true,
            autoAdvance: true,
            confirmCancel: false,
            ...options
        };

        // Setup cancellation handling
        this.setupCancellationHandler();
    }

    /**
     * Setup cancellation handler for multi-step operations
     */
    setupCancellationHandler() {
        const cancelHandler = async () => {
            if (this.cancelled) {
                console.log('\nForce exit...');
                process.exit(1);
                return;
            }

            console.log('\n');
            
            if (this.options.confirmCancel) {
                const inquirer = require('inquirer');
                
                try {
                    const answer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Cancel multi-step operation? This may leave the system in an incomplete state.',
                        default: false
                    }]);

                    if (answer.confirm) {
                        await this.cancel('Multi-step operation cancelled by user');
                    } else {
                        console.log('Continuing operation...');
                        this.renderSteps();
                    }
                } catch (error) {
                    await this.cancel('Multi-step operation cancelled by user');
                }
            } else {
                await this.cancel('Multi-step operation cancelled by user');
            }
        };

        process.on('SIGINT', cancelHandler);
        process.on('SIGTERM', cancelHandler);
        this.cancelHandler = cancelHandler;
    }

    /**
     * Cancel the multi-step operation with cleanup
     */
    async cancel(reason = 'Operation cancelled') {
        this.cancelled = true;
        
        // Mark current step as cancelled
        if (this.currentStepIndex < this.steps.length) {
            const currentStep = this.steps[this.currentStepIndex];
            if (currentStep.status === 'running') {
                currentStep.status = 'cancelled';
                currentStep.endTime = Date.now();
            }
        }

        // Run cleanup tasks in reverse order
        for (let i = this.cleanupTasks.length - 1; i >= 0; i--) {
            try {
                await this.cleanupTasks[i]();
            } catch (error) {
                console.error(`Cleanup task ${i} failed:`, error.message);
            }
        }

        this.renderSteps();
        console.log(chalk.yellow(`\n${reason}`));
        
        this.emit('cancelled', { reason, completedSteps: this.getCompletedCount() });
        
        // Remove signal handlers
        if (this.cancelHandler) {
            process.removeListener('SIGINT', this.cancelHandler);
            process.removeListener('SIGTERM', this.cancelHandler);
        }
        
        process.exit(0);
    }

    /**
     * Add cleanup task to be executed on cancellation
     */
    addCleanupTask(cleanupFn) {
        if (typeof cleanupFn === 'function') {
            this.cleanupTasks.push(cleanupFn);
        }
    }

    /**
     * Remove cleanup task
     */
    removeCleanupTask(cleanupFn) {
        const index = this.cleanupTasks.indexOf(cleanupFn);
        if (index > -1) {
            this.cleanupTasks.splice(index, 1);
        }
    }

    /**
     * Start the multi-step progress with enhanced tracking
     */
    start() {
        this.totalStartTime = Date.now();
        console.log(chalk.blue(`Starting ${this.steps.length} step process...\n`));
        this.renderSteps();
        return this;
    }

    /**
     * Start a specific step with enhanced tracking
     * @param {number} stepIndex - Step index to start
     * @param {string} description - Optional description update
     */
    startStep(stepIndex = this.currentStepIndex, description = null) {
        if (stepIndex >= this.steps.length || this.cancelled) return;

        const step = this.steps[stepIndex];
        step.status = 'running';
        step.startTime = Date.now();
        step.memoryUsage = this.getMemoryUsage();

        if (description) {
            step.description = description;
        }

        this.renderSteps();
        this.emit('stepStart', { step, index: stepIndex });
        return this;
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        try {
            const usage = process.memoryUsage();
            return Math.round(usage.heapUsed / 1024 / 1024); // MB
        } catch (error) {
            return null;
        }
    }

    /**
     * Complete a step successfully
     * @param {number} stepIndex - Step index to complete
     * @param {string} description - Optional description update
     */
    completeStep(stepIndex = this.currentStepIndex, description = null) {
        if (stepIndex >= this.steps.length) return;

        const step = this.steps[stepIndex];
        step.status = 'completed';
        step.endTime = Date.now();
        step.progress = 100;

        if (description) {
            step.description = description;
        }

        if (this.options.autoAdvance) {
            this.currentStepIndex = stepIndex + 1;
        }

        this.renderSteps();
        this.emit('stepComplete', { step, index: stepIndex });

        // Check if all steps are completed
        if (this.isAllCompleted()) {
            this.emit('allComplete');
        }

        return this;
    }

    /**
     * Fail a step
     * @param {number} stepIndex - Step index to fail
     * @param {Error} error - Error that caused failure
     * @param {string} description - Optional description update
     */
    failStep(stepIndex = this.currentStepIndex, error = null, description = null) {
        if (stepIndex >= this.steps.length) return;

        const step = this.steps[stepIndex];
        step.status = 'failed';
        step.endTime = Date.now();
        step.error = error;

        if (description) {
            step.description = description;
        }

        this.renderSteps();
        this.emit('stepFail', { step, index: stepIndex, error });
        return this;
    }

    /**
     * Skip a step
     * @param {number} stepIndex - Step index to skip
     * @param {string} reason - Reason for skipping
     */
    skipStep(stepIndex = this.currentStepIndex, reason = 'Skipped') {
        if (stepIndex >= this.steps.length) return;

        const step = this.steps[stepIndex];
        step.status = 'skipped';
        step.description = reason;

        if (this.options.autoAdvance) {
            this.currentStepIndex = stepIndex + 1;
        }

        this.renderSteps();
        this.emit('stepSkip', { step, index: stepIndex, reason });
        return this;
    }

    /**
     * Update step progress
     * @param {number} stepIndex - Step index to update
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} description - Optional description update
     */
    updateStepProgress(stepIndex = this.currentStepIndex, progress = 0, description = null) {
        if (stepIndex >= this.steps.length) return;

        const step = this.steps[stepIndex];
        step.progress = Math.min(Math.max(progress, 0), 100);

        if (description) {
            step.description = description;
        }

        this.renderSteps();
        this.emit('stepProgress', { step, index: stepIndex, progress });
        return this;
    }

    /**
     * Render all steps with enhanced information
     */
    renderSteps() {
        // Clear previous output
        console.clear();

        const completedCount = this.getCompletedCount();
        const totalElapsed = this.totalStartTime ? this.formatDuration(Date.now() - this.totalStartTime) : '';
        const overallETA = this.calculateOverallETA();

        let header = chalk.blue(`Progress: ${completedCount}/${this.steps.length} steps completed`);
        
        if (this.options.showElapsed && totalElapsed) {
            header += chalk.gray(` | Elapsed: ${totalElapsed}`);
        }
        
        if (this.options.showETA && overallETA) {
            header += chalk.gray(` | ETA: ${overallETA}`);
        }

        if (this.options.showMemory) {
            const currentMemory = this.getMemoryUsage();
            if (currentMemory) {
                header += chalk.gray(` | Memory: ${currentMemory}MB`);
            }
        }

        console.log(header + '\n');

        this.steps.forEach((step, index) => {
            const icon = this.getStepIcon(step.status);
            const name = chalk.bold(step.name);
            const description = step.description ? ` - ${step.description}` : '';
            const elapsed = step.startTime ? this.getStepElapsed(step) : '';

            let line = `${icon} ${name}${description}`;

            if (this.options.showElapsed && elapsed) {
                line += chalk.gray(` (${elapsed})`);
            }

            // Show memory usage for completed steps
            if (this.options.showMemory && step.memoryUsage) {
                line += chalk.gray(` [${step.memoryUsage}MB]`);
            }

            if (this.options.showProgress && step.status === 'running' && step.progress > 0) {
                const progressBar = this.createProgressBar(step.progress);
                line += `\n    ${progressBar}`;
                
                // Show step ETA
                if (this.options.showETA) {
                    const stepETA = this.calculateStepETA(step);
                    if (stepETA) {
                        line += chalk.gray(` | ETA: ${stepETA}`);
                    }
                }
            }

            if (step.error) {
                line += chalk.red(`\n    Error: ${step.error.message}`);
            }

            console.log(line);
        });

        console.log(); // Empty line at the end
    }

    /**
     * Calculate overall ETA for remaining steps
     */
    calculateOverallETA() {
        if (!this.totalStartTime || this.cancelled) return null;

        const completedSteps = this.steps.filter(s => s.status === 'completed' || s.status === 'skipped');
        const remainingSteps = this.steps.filter(s => s.status === 'pending');

        if (completedSteps.length === 0 || remainingSteps.length === 0) return null;

        // Calculate average time per completed step
        const totalCompletedTime = completedSteps.reduce((sum, step) => {
            if (step.startTime && step.endTime) {
                return sum + (step.endTime - step.startTime);
            }
            return sum;
        }, 0);

        if (totalCompletedTime === 0) return null;

        const avgTimePerStep = totalCompletedTime / completedSteps.length;
        const estimatedRemainingTime = avgTimePerStep * remainingSteps.length;

        return this.formatDuration(estimatedRemainingTime);
    }

    /**
     * Calculate ETA for current step
     */
    calculateStepETA(step) {
        if (!step.startTime || step.progress === 0 || step.status !== 'running') return null;

        const elapsed = Date.now() - step.startTime;
        const rate = step.progress / elapsed;
        const remaining = 100 - step.progress;
        const eta = remaining / rate;

        return this.formatDuration(eta);
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return null;

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get icon for step status
     * @param {string} status - Step status
     * @returns {string} Colored icon
     */
    getStepIcon(status) {
        switch (status) {
            case 'pending': return chalk.gray('○');
            case 'running': return chalk.blue('●');
            case 'completed': return chalk.green('✓');
            case 'failed': return chalk.red('✗');
            case 'skipped': return chalk.yellow('⊘');
            default: return chalk.gray('○');
        }
    }

    /**
     * Get elapsed time for a step
     * @param {Object} step - Step object
     * @returns {string} Formatted elapsed time
     */
    getStepElapsed(step) {
        if (!step.startTime) return '';

        const endTime = step.endTime || Date.now();
        const elapsed = endTime - step.startTime;
        const seconds = Math.floor(elapsed / 1000);

        if (seconds < 60) {
            return `${seconds}s`;
        }

        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    }

    /**
     * Create a simple progress bar
     * @param {number} progress - Progress percentage
     * @returns {string} Progress bar string
     */
    createProgressBar(progress) {
        const width = 30;
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;

        return `[${chalk.cyan('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}] ${progress}%`;
    }

    /**
     * Check if all steps are completed
     * @returns {boolean} True if all steps are completed or skipped
     */
    isAllCompleted() {
        return this.steps.every(step =>
            step.status === 'completed' || step.status === 'skipped'
        );
    }

    /**
     * Get count of completed steps
     * @returns {number} Number of completed steps
     */
    getCompletedCount() {
        return this.steps.filter(step =>
            step.status === 'completed' || step.status === 'skipped'
        ).length;
    }

    /**
     * Get summary of all steps
     * @returns {Object} Summary object
     */
    getSummary() {
        const summary = {
            total: this.steps.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            pending: 0,
            running: 0
        };

        this.steps.forEach(step => {
            summary[step.status]++;
        });

        return summary;
    }
}

/**
 * Utility functions for creating progress indicators
 */
class ProgressUtils {

    /**
     * Create a simple spinner
     * @param {string} text - Spinner text
     * @param {Object} options - Spinner options
     * @returns {ProgressIndicator} Progress indicator instance
     */
    static spinner(text = 'Loading...', options = {}) {
        return new ProgressIndicator({
            type: 'spinner',
            text,
            ...options
        });
    }

    /**
     * Create a progress bar
     * @param {string} text - Progress bar text
     * @param {number} total - Total progress value
     * @param {Object} options - Progress bar options
     * @returns {ProgressIndicator} Progress indicator instance
     */
    static progressBar(text = 'Processing...', total = 100, options = {}) {
        return new ProgressIndicator({
            type: 'progress',
            text,
            total,
            ...options
        });
    }

    /**
     * Create a step progress indicator
     * @param {string} text - Step text
     * @param {number} total - Total steps
     * @param {Object} options - Step options
     * @returns {ProgressIndicator} Progress indicator instance
     */
    static steps(text = 'Processing steps...', total = 10, options = {}) {
        return new ProgressIndicator({
            type: 'steps',
            text,
            total,
            ...options
        });
    }

    /**
     * Create a multi-step progress manager
     * @param {Array} steps - Array of step definitions
     * @param {Object} options - Multi-step options
     * @returns {MultiStepProgress} Multi-step progress instance
     */
    static multiStep(steps = [], options = {}) {
        return new MultiStepProgress(steps, options);
    }
}

module.exports = {
    ProgressIndicator,
    MultiStepProgress,
    ProgressUtils
};