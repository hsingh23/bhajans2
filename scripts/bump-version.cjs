const { execSync } = require('child_process');
const fs = require('fs');

// Prevent infinite loop if the script calls git commit again
if (process.env.SKIP_BUMP_HOOK === '1') {
  process.exit(0);
}

try {
  // Get the last commit message
  const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
  console.log('Analyzing commit message:', commitMsg);

  // Determine bump type
  let bumpType = 'patch'; // Default as per user request ("else patch")

  if (commitMsg.includes('BREAKING CHANGE') || commitMsg.includes('BREAKING-CHANGE')) {
    bumpType = 'major';
  } else if (commitMsg.startsWith('feat')) {
    bumpType = 'minor';
  } else if (commitMsg.startsWith('fix')) {
    bumpType = 'patch';
  }
  // All other types (chore, docs, style, etc.) fall through to 'patch'

  console.log(`Bumping version: ${bumpType}`);

  // Bump version without creating a tag or git commit (we will do it manually)
  execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });

  // Sync bun.lock
  // running bun install should update the lockfile to match the new package.json version
  try {
     console.log('Syncing lockfile...');
     execSync('bun install', { stdio: 'inherit' });
  } catch (e) {
     console.warn('Warning: bun install failed or bun not found, lockfile might be out of sync.');
  }

  // Stage the changes
  // We explicitly add bun.lock. If it doesn't exist, this might fail, but we saw it in list_dir.
  // Using 'git add .' might be too broad if other files are modified/untracked? 
  // Ideally we only want to stage the version files.
  // But post-commit implies the working tree is clean usually (except for what we just changed).
  try {
    execSync('git add package.json bun.lock', { stdio: 'inherit' });
  } catch (e) {
    // Fallback if bun.lock fails (e.g. if it didn't change or doesn't exist unexpectedly)
    execSync('git add package.json', { stdio: 'inherit' });
  }

  // Amend the commit
  // We use SKIP_BUMP_HOOK=1 to prevent re-triggering this hook
  console.log('Amending commit...');
  execSync('git commit --amend --no-edit --no-verify', { 
    stdio: 'inherit',
    env: { ...process.env, SKIP_BUMP_HOOK: '1' }
  });

  console.log('Version bumped and commit amended successfully.');

} catch (error) {
  console.error('Error in auto-version bump:', error.message);
  // We don't exit with error code 1 because that might mess up the git workflow?
  // Actually, if post-commit fails, the commit is already done. It just shows error in stderr.
  // We should let the user know.
  process.exit(1);
}
