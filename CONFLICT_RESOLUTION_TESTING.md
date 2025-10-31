# Conflict Resolution Testing Guide

This document provides step-by-step manual testing instructions for the new conflict resolution functionality in Histofy v3.

## Prerequisites

1. Ensure you have a Git repository with some commit history
2. Have Histofy v3 installed and configured
3. Backup your repository before testing (or use a test repository)

## Test Scenarios

### Test 1: Basic Conflict Detection

**Objective**: Verify that conflict detection works correctly

**Steps**:
1. Run the test script:
   ```bash
   node test-conflict-resolution.js
   ```

**Expected Result**:
- All tests should pass
- Should show "Has conflicts: false" for a clean repository
- Should show backup creation and cleanup working

**Verification**:
- ✅ Test script completes successfully
- ✅ No errors in conflict detection
- ✅ Backup creation and cleanup works

### Test 2: Migration with Backup Creation

**Objective**: Test migration with automatic backup creation

**Steps**:
1. Create a test commit:
   ```bash
   echo "test content" > test-file.txt
   git add test-file.txt
   git commit -m "Test commit for migration"
   ```

2. Run migration with backup (plan only):
   ```bash
   histofy migrate HEAD~1..HEAD --to-date "2023-06-15" --start-time "10:00"
   ```

3. Execute migration with backup:
   ```bash
   histofy migrate HEAD~1..HEAD --to-date "2023-06-15" --start-time "10:00" --execute
   ```

**Expected Result**:
- Migration plan should be generated successfully
- Backup branch should be created before execution
- Migration should complete successfully
- Backup branch should be available for rollback

**Verification**:
- ✅ Migration plan displays correctly
- ✅ Backup branch is created (check with `git branch`)
- ✅ Migration completes without errors
- ✅ Commit date is updated correctly (`git log --pretty=format:"%h %ad %s" --date=short`)

### Test 3: Migration with No Backup Option

**Objective**: Test migration without backup creation

**Steps**:
1. Create another test commit:
   ```bash
   echo "test content 2" > test-file2.txt
   git add test-file2.txt
   git commit -m "Test commit 2 for migration"
   ```

2. Run migration without backup:
   ```bash
   histofy migrate HEAD~1..HEAD --to-date "2023-06-16" --no-backup --execute
   ```

**Expected Result**:
- Warning should be displayed about no backup
- Migration should proceed without creating backup
- Migration should complete successfully

**Verification**:
- ✅ Warning message about no backup is displayed
- ✅ No backup branch is created
- ✅ Migration completes successfully

### Test 4: Migration with Auto-Resolve Strategy

**Objective**: Test automatic conflict resolution strategies

**Steps**:
1. Create a scenario that might cause conflicts (this is advanced and may require manual setup)
2. Run migration with auto-resolve:
   ```bash
   histofy migrate HEAD~2..HEAD --to-date "2023-06-17" --auto-resolve "theirs" --execute
   ```

**Expected Result**:
- Auto-resolve strategy should be acknowledged
- If conflicts occur, they should be resolved automatically
- Migration should complete or provide clear error messages

**Verification**:
- ✅ Auto-resolve strategy is displayed
- ✅ Migration handles conflicts appropriately
- ✅ Clear feedback is provided

### Test 5: Migration Help and Options

**Objective**: Verify all new command options are available

**Steps**:
1. Check migrate command help:
   ```bash
   histofy migrate --help
   ```

**Expected Result**:
- All new options should be listed:
  - `--auto-resolve <strategy>`
  - `--no-backup`
  - `--no-rollback`

**Verification**:
- ✅ All new options are displayed in help
- ✅ Option descriptions are clear and accurate

### Test 6: Error Handling and Validation

**Objective**: Test error handling for invalid inputs

**Steps**:
1. Test invalid auto-resolve strategy:
   ```bash
   histofy migrate HEAD~1..HEAD --to-date "2023-06-18" --auto-resolve "invalid" --execute
   ```

2. Test migration on non-existent range:
   ```bash
   histofy migrate nonexistent..HEAD --to-date "2023-06-18" --execute
   ```

**Expected Result**:
- Invalid auto-resolve strategy should show warning
- Non-existent range should show appropriate error
- Error messages should be clear and helpful

**Verification**:
- ✅ Invalid strategy shows warning but continues
- ✅ Invalid range shows clear error message
- ✅ Error handling is graceful

## Manual Conflict Resolution Testing

**Note**: This requires creating actual merge conflicts, which is more complex. Here's a basic approach:

### Creating a Conflict Scenario

1. Create a branch and make conflicting changes:
   ```bash
   git checkout -b conflict-test
   echo "version 1" > conflict-file.txt
   git add conflict-file.txt
   git commit -m "Version 1"
   
   git checkout main
   echo "version 2" > conflict-file.txt
   git add conflict-file.txt
   git commit -m "Version 2"
   
   # Try to merge (this should create conflicts)
   git merge conflict-test
   ```

2. If conflicts are created, test the conflict resolution:
   ```bash
   histofy migrate HEAD~1..HEAD --to-date "2023-06-19" --execute
   ```

3. Follow the interactive prompts for conflict resolution

**Expected Result**:
- Conflicts should be detected
- Interactive resolution options should be presented
- Manual resolution should guide user through the process
- Automatic resolution should work with chosen strategy

## Cleanup After Testing

1. Remove test files:
   ```bash
   rm -f test-file.txt test-file2.txt conflict-file.txt
   ```

2. Remove test branches:
   ```bash
   git branch -D conflict-test 2>/dev/null || true
   ```

3. Remove backup branches (if any):
   ```bash
   git branch | grep "histofy-backup" | xargs -r git branch -D
   ```

4. Remove test script:
   ```bash
   rm -f test-conflict-resolution.js
   ```

## Success Criteria

All tests pass if:
- ✅ Conflict detection works without errors
- ✅ Backup creation and management functions correctly
- ✅ Migration with new options completes successfully
- ✅ Error handling provides clear, helpful messages
- ✅ Help documentation shows all new options
- ✅ Auto-resolve strategies are recognized and handled
- ✅ Repository validation works correctly

## Troubleshooting

If tests fail:
1. Check that you're in a valid Git repository
2. Ensure you have commit history to work with
3. Verify Histofy is properly installed (`histofy --version`)
4. Check Git status (`git status`) for any existing issues
5. Review error messages for specific guidance

## Notes

- The conflict resolution functionality is designed to be safe with automatic backup creation
- Manual conflict resolution provides step-by-step guidance
- Automatic rollback helps prevent repository corruption
- All operations can be undone using the backup branches created