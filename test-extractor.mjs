// Simple test script for github-extractor
// Run with: node test-extractor.mjs

import { extractGitHubRepo } from './lib/github-extractor.ts';

const repoUrl = process.argv[2] || 'octocat/Hello-World';
const branch = process.argv[3];

try {
  const outputPath = await extractGitHubRepo(repoUrl, { branch });
  console.log(`\nSuccess! Output saved to: ${outputPath}`);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
