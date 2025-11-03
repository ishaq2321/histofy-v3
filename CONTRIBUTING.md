# Contributing to Histofy v3 🤝

Thank you for your interest in contributing to **Histofy v3** - the advanced terminal-based Git history manipulation tool!

## 🏛️ Original Creator & Copyright

**Histofy v3** was created by **Ishaq** (ishaq2321@proton.me) in 2025. All contributions become part of the project under the MIT License while respecting the original creator's copyright.

## 🚀 Getting Started

### Prerequisites
- **Node.js 16+** (LTS recommended)
- **Git 2.20+**
- **GitHub account**
- **Understanding of JavaScript/Node.js**
- **Familiarity with CLI tools and Git operations**

### Development Setup
```bash
# Fork the repository on GitHub first

# Clone your fork
git clone https://github.com/YOUR_USERNAME/histofy-v3.git
cd histofy-v3

# Add upstream remote
git remote add upstream https://github.com/ishaq2321/histofy-v3.git

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Run tests with coverage
npm run test:coverage

# Link for local testing
npm link

# Verify installation
histofy --version
```

## 🏗️ Project Structure

```
histofy-v3/
├── src/
│   ├── cli/           # CLI command implementations
│   ├── core/          # Core functionality (GitManager, OperationManager)
│   ├── config/        # Configuration management
│   ├── security/      # Security utilities
│   └── utils/         # Utility functions and helpers
├── tests/             # Test files (mirrors src structure)
├── shell/             # Shell integration scripts
├── docs/              # Documentation
└── bin/               # Executable files
```

## 🛠️ Development Workflow

### 1. Sync with Upstream
```bash
git fetch upstream
git checkout main
git merge upstream/main
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
# or
git checkout -b docs/documentation-update
```

### 3. Development Guidelines

#### Code Style
- **ES6+ JavaScript** with modern syntax
- **Consistent indentation** (2 spaces)
- **Meaningful variable names** and function names
- **JSDoc comments** for public APIs
- **Error handling** for all operations
- **Input validation** and sanitization

#### Security Requirements
- **Validate all user inputs** using ValidationUtils
- **Sanitize command parameters** to prevent injection
- **Use SecurityUtils** for sensitive operations
- **Encrypt sensitive configuration** data
- **Never log sensitive information**

#### Performance Considerations
- **Use streaming operations** for large datasets
- **Implement progress tracking** for long operations
- **Add performance monitoring** for new features
- **Optimize memory usage** and garbage collection
- **Use caching** where appropriate

### 4. Testing Requirements

#### Test Coverage
- **Minimum 90% code coverage** for new code
- **Unit tests** for all functions and classes
- **Integration tests** for CLI commands
- **Security tests** for input validation
- **Performance tests** for optimization

#### Test Structure
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/cli/commit.test.js

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance

# Run security tests
npm run test:security
```

#### Writing Tests
```javascript
// Example test structure
describe('FeatureName', () => {
  let mockDependency;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDependency = jest.fn();
  });
  
  describe('method name', () => {
    test('should handle normal case', () => {
      // Test implementation
    });
    
    test('should handle error case', () => {
      // Error handling test
    });
    
    test('should validate inputs', () => {
      // Input validation test
    });
  });
});
```

### 5. Documentation Requirements

#### Code Documentation
- **JSDoc comments** for all public methods
- **Inline comments** for complex logic
- **README updates** for new features
- **Help system updates** for new commands
- **Example usage** in documentation

#### Documentation Updates
- Update **README.md** for new features
- Add **examples** to HelpSystem
- Update **TROUBLESHOOTING.md** for new issues
- Add **FAQ entries** for common questions
- Update **API documentation** if applicable

### 6. Commit Guidelines

#### Conventional Commits
```bash
git commit -m "feat: add new CLI feature"
git commit -m "fix: resolve date parsing issue"
git commit -m "docs: update README installation guide"
```

### 4. Submit Pull Request
- Create a clear PR description
- Reference any related issues
- Include testing instructions
- Wait for code review

## 📋 Contribution Areas

### 🔥 High Priority
- Bug fixes and stability improvements
- Performance optimizations
- Cross-platform compatibility
- Documentation improvements
- Test coverage expansion

### 🌟 Feature Requests
- New CLI features
- Additional shell integrations
- Enhanced CLI features
- Better error handling
- UI/UX improvements

### 🎨 Creative Contributions
- CLI improvements
- Shell function improvements
- Better output formatting
- Developer experience enhancements

## 🧪 Testing Guidelines

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="GitManager"

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests
- Add tests for all new functionality
- Follow existing test patterns
- Include both positive and negative test cases
- Test edge cases and error conditions

## 📝 Code Style

### JavaScript Guidelines
- Use modern ES6+ features
- Follow existing naming conventions
- Add JSDoc comments for functions
- Keep functions focused and small
- Handle errors gracefully

### File Organization
```
src/
├── cli/           # Command handlers
├── core/          # Business logic
├── config/        # Configuration management
└── utils/         # Utility functions

tests/             # Test files (mirror src structure)
tests/            # Test files
shell/             # Shell integration scripts
```

## 🐛 Bug Reports

### Before Reporting
- Check existing issues
- Test with latest version
- Reproduce the issue
- Gather system information

### Bug Report Template
```markdown
**Description**: Brief description of the bug

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- OS: [Linux/macOS/Windows]
- Node.js version: [x.x.x]
- Histofy version: [x.x.x]

**Additional Context**: Any other relevant information
```

## 💡 Feature Requests

### Feature Request Template
```markdown
**Feature Description**: Brief description of the feature

**Use Case**: Why is this feature needed? What problem does it solve?

**Proposed Solution**: How would you like this feature to work?

**Alternatives Considered**: Any alternative approaches you've considered?

**Additional Context**: Any other relevant information, mockups, examples
```

## 🎯 Contribution Recognition

### Contributors Hall of Fame
All contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation
- Social media shoutouts

### Types of Recognition
- **Code Contributors**: Direct code improvements
- **Documentation**: Docs, guides, tutorials
- **Testing**: Bug reports, test improvements
- **Community**: Support, advocacy, feedback
- **Design**: UI/UX, branding, graphics

## ⚖️ Legal & Licensing

### Contributor License Agreement
By contributing to Histofy v3, you agree that:
- Your contributions are your original work
- You grant rights under the MIT License
- You respect the original creator's copyright
- You will not claim ownership of the entire project

### Copyright Notice
All files must include the copyright header:
```javascript
/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 */
```

## 🌍 Community Guidelines

### Be Respectful
- Use inclusive language
- Respect different perspectives
- Be constructive in feedback
- Help others learn and grow

### Be Professional
- Keep discussions technical and relevant
- Avoid personal attacks or inflammatory language
- Focus on the code and improvements
- Maintain a positive environment

### Be Collaborative
- Share knowledge and experience
- Help newcomers get started
- Review others' contributions thoughtfully
- Celebrate collective achievements

## 📞 Contact & Support

### Get Help
- **GitHub Issues**: Technical problems, bugs
- **Email**: ishaq2321@proton.me (for sensitive matters)
- **Discussions**: GitHub Discussions for general questions

### Response Times
- Bug reports: 24-48 hours
- Feature requests: 1-2 weeks
- Pull requests: 3-5 days
- General questions: 1-2 days

## 🙏 Thank You

Every contribution, no matter how small, makes Histofy v3 better for everyone. Whether you're fixing a typo, adding a feature, or helping someone in discussions, your efforts are appreciated!

**Happy coding! 🚀**

---

*Histofy v3 - Built with ❤️ by Ishaq and the community*
*🇵🇸 In solidarity with Palestine*
# Use conventional commit format
git commit -m "feat: add performance monitoring to batch operations"
git commit -m "fix: resolve memory leak in streaming operations"
git commit -m "docs: update README with new batch features"
git commit -m "test: add comprehensive tests for help system"
git commit -m "refactor: optimize Git operation batching"
git commit -m "security: enhance input validation for file operations"
```

#### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `security`: Security improvements
- `perf`: Performance improvements
- `style`: Code style changes
- `ci`: CI/CD changes

### 7. Pull Request Process

#### Before Submitting
```bash
# Ensure all tests pass
npm test

# Check code coverage
npm run test:coverage

# Run linting
npm run lint

# Check for security issues
npm audit

# Update documentation
npm run docs:generate
```

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security enhancement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Performance testing completed

## Documentation
- [ ] README updated
- [ ] Help system updated
- [ ] API documentation updated
- [ ] Examples added

## Security
- [ ] Input validation implemented
- [ ] Security review completed
- [ ] No sensitive data exposed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## 🎯 Contribution Areas

### High Priority
- **Performance optimizations** for large repositories
- **Security enhancements** and vulnerability fixes
- **Test coverage improvements**
- **Documentation and examples**
- **Bug fixes** and stability improvements

### Medium Priority
- **New CLI commands** and features
- **Enhanced error handling** and recovery
- **Shell integration** improvements
- **Configuration management** enhancements
- **GitHub API** optimizations

### Low Priority
- **Code refactoring** and cleanup
- **Developer experience** improvements
- **Build process** optimizations
- **Dependency updates**
- **Style and formatting** improvements

## 🔒 Security Guidelines

### Reporting Security Issues
- **Email privately**: ishaq2321@proton.me
- **Include**: Description, reproduction steps, impact
- **Do not** create public issues for security vulnerabilities

### Security Best Practices
- **Validate all inputs** using existing validation utilities
- **Sanitize command parameters** to prevent injection attacks
- **Use secure file operations** with path validation
- **Encrypt sensitive data** in configuration
- **Follow principle of least privilege**
- **Audit dependencies** regularly

## 📊 Performance Guidelines

### Performance Requirements
- **Memory usage**: Efficient for repositories with 100k+ commits
- **Execution time**: Operations should complete within reasonable time
- **Progress tracking**: Long operations must show progress
- **Resource cleanup**: Proper cleanup of resources and memory
- **Streaming support**: Large datasets should use streaming

### Performance Testing
```bash
# Run performance benchmarks
npm run test:performance

# Profile specific operations
histofy --profile migrate HEAD~1000..HEAD --to-date 2023-06-15

# Monitor memory usage
histofy performance --enable
histofy batch commit --input large-dataset.csv
histofy performance --report
```

## 🧪 Testing Guidelines

### Test Categories
1. **Unit Tests**: Individual functions and classes
2. **Integration Tests**: CLI commands and workflows
3. **Security Tests**: Input validation and injection prevention
4. **Performance Tests**: Large dataset handling and optimization
5. **End-to-End Tests**: Complete user workflows

### Test Requirements
- **Comprehensive coverage** of new functionality
- **Error case testing** for all failure scenarios
- **Input validation testing** for security
- **Performance regression testing**
- **Cross-platform compatibility** testing

### Mock Guidelines
- **Mock external dependencies** (Git, GitHub API, file system)
- **Use consistent mocking patterns**
- **Test both success and failure scenarios**
- **Verify mock interactions** where appropriate

## 📝 Documentation Standards

### Code Documentation
```javascript
/**
 * Migrate commits to new dates with automatic backup
 * @param {string} range - Git commit range (e.g., 'HEAD~5..HEAD')
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @param {Object} options - Migration options
 * @param {boolean} options.force - Force migration despite conflicts
 * @param {boolean} options.dryRun - Preview changes without executing
 * @returns {Promise<Object>} Migration result with success status and details
 * @throws {ValidationError} When range or date format is invalid
 * @throws {GitError} When Git operations fail
 * @example
 * const result = await migrateCommits('HEAD~5..HEAD', '2023-06-15', {
 *   force: false,
 *   dryRun: true
 * });
 */
async function migrateCommits(range, targetDate, options = {}) {
  // Implementation
}
```

### Help System Updates
When adding new commands or options:
1. **Add examples** to HelpSystem.js
2. **Update contextual help** for new error cases
3. **Create tutorials** for complex features
4. **Update troubleshooting guide** for new issues

## 🚀 Release Process

### Version Numbering
- **Major** (x.0.0): Breaking changes
- **Minor** (x.y.0): New features, backward compatible
- **Patch** (x.y.z): Bug fixes, backward compatible

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Security audit completed
- [ ] Performance benchmarks run
- [ ] Cross-platform testing completed

## 🤝 Community Guidelines

### Code of Conduct
- **Be respectful** and inclusive
- **Provide constructive feedback**
- **Help newcomers** get started
- **Focus on the code**, not the person
- **Collaborate effectively**

### Communication
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Requests**: Code contributions and reviews
- **Email**: Security issues and private matters

### Recognition
Contributors are recognized in:
- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributors** page
- **Special mentions** for major features

## 📚 Resources

### Learning Resources
- [Node.js Documentation](https://nodejs.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/)
- [Commander.js CLI Framework](https://github.com/tj/commander.js/)
- [Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain)

### Development Tools
- **VS Code** with recommended extensions
- **Node.js debugger** for debugging
- **Jest** for testing
- **ESLint** for code quality
- **Prettier** for code formatting

### Useful Commands
```bash
# Development server with auto-reload
npm run dev

# Run specific test suite
npm test -- --testNamePattern="HelpSystem"

# Debug specific test
node --inspect-brk node_modules/.bin/jest tests/cli/help.test.js

# Generate documentation
npm run docs:generate

# Check dependencies for vulnerabilities
npm audit

# Update dependencies
npm update
```

## 🎉 Getting Your First Contribution Merged

### Good First Issues
Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`
- `tests`

### Tips for Success
1. **Start small** with documentation or test improvements
2. **Ask questions** if anything is unclear
3. **Follow the guidelines** in this document
4. **Be patient** during the review process
5. **Learn from feedback** and iterate

### After Your PR is Merged
- **Update your fork** with the latest changes
- **Consider more contributions** in related areas
- **Help review other PRs** when you're comfortable
- **Share your experience** with other contributors

## 🙏 Thank You!

Every contribution, no matter how small, helps make Histofy better for everyone. Whether you're fixing a typo, adding a feature, or helping with documentation, your efforts are appreciated!

**Questions?** Feel free to reach out:
- 📧 Email: ishaq2321@proton.me
- 💬 GitHub Discussions: [histofy-v3/discussions](https://github.com/ishaq2321/histofy-v3/discussions)

---

**Happy Contributing!** 🚀