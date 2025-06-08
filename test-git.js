const simpleGit = require('simple-git');

class GitManager {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async isGitRepo() {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = GitManager;
