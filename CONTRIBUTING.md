# Contributing to Histofy v3 🤝

Thank you for your interest in contributing to **Histofy v3** - the terminal-based GitHub history manipulation tool!

## 🏛️ Original Creator & Copyright

**Histofy v3** was created by **Ishaq** (ishaq2321@proton.me) in 2025. All contributions become part of the project under the MIT License while respecting the original creator's copyright.

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ 
- Git
- GitHub account
- Basic understanding of JavaScript/CLI tools

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/ishaq2321/histofy-v3.git
cd histofy-v3

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Link for local testing
npm link
```

## 🛠️ Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass: `npm test`

### 3. Commit Guidelines
```bash
# Use conventional commit format
git commit -m "feat: add new pattern system feature"
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
- New contribution patterns
- Additional shell integrations
- Enhanced CLI features
- Better error handling
- UI/UX improvements

### 🎨 Creative Contributions
- Pattern templates
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
templates/         # Pattern templates
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
