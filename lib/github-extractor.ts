import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

// File extensions to exclude (binary and generated files)
const EXCLUDED_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp', '.tiff',
  // Fonts
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  // Binary/compiled
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  // Media
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  // Generated/minified
  '.min.js', '.min.css', '.map',
  // Lock files
  '.lock',
]);

// Directories to exclude
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.turbo',
  '.vercel',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'target', // Rust
  'vendor', // Go/PHP
]);

// Specific files to exclude
const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.DS_Store',
  'Thumbs.db',
]);

interface ExtractOptions {
  branch?: string;
  outputFileName?: string;
}

interface ExtractContentOptions {
  branch?: string;
}

interface FileEntry {
  path: string;
  content: string;
}

/**
 * Check if a string is a GitHub URL or owner/repo format
 */
export function isGitHubUrl(text: string): boolean {
  const trimmed = text.trim();
  // Check for GitHub URL
  if (trimmed.match(/^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/\s]+/)) {
    return true;
  }
  // Check for owner/repo format (e.g., "vercel/next.js")
  if (trimmed.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/) && !trimmed.includes(' ')) {
    return true;
  }
  return false;
}

/**
 * Parse GitHub URL or owner/repo format to extract owner and repo name
 */
export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } {
  // Handle full URL: https://github.com/owner/repo or https://github.com/owner/repo.git
  const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Handle owner/repo format
  const shortMatch = repoUrl.match(/^([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  throw new Error(`Invalid GitHub repository format: ${repoUrl}. Use "owner/repo" or full GitHub URL.`);
}

/**
 * Check if a file should be excluded based on its path
 */
function shouldExclude(filePath: string): boolean {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];

  // Check if any directory in path should be excluded
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part)) {
      return true;
    }
  }

  // Check if file is in excluded files list
  if (EXCLUDED_FILES.has(fileName)) {
    return true;
  }

  // Check file extension
  const ext = path.extname(fileName).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return true;
  }

  // Check for .min.js and .min.css patterns
  if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) {
    return true;
  }

  return false;
}

/**
 * Check if content appears to be binary
 */
function isBinaryContent(content: Uint8Array): boolean {
  // Check first 8000 bytes for null bytes or high ratio of non-printable chars
  const checkLength = Math.min(content.length, 8000);
  let nonPrintable = 0;

  for (let i = 0; i < checkLength; i++) {
    const byte = content[i];
    // Null byte is a strong indicator of binary
    if (byte === 0) return true;
    // Count non-printable, non-whitespace characters
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonPrintable++;
    }
  }

  // If more than 10% non-printable, likely binary
  return nonPrintable / checkLength > 0.1;
}

/**
 * Build a tree structure string from file paths
 */
function buildDirectoryTree(files: FileEntry[]): string {
  const tree: Map<string, Set<string>> = new Map();
  
  // Build directory structure
  for (const file of files) {
    const parts = file.path.split('/');
    
    for (let i = 0; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/') || '.';
      const item = parts[i];
      const isDir = i < parts.length - 1;
      
      if (!tree.has(dirPath)) {
        tree.set(dirPath, new Set());
      }
      tree.get(dirPath)!.add(isDir ? item + '/' : item);
    }
  }

  // Format tree as string
  const lines: string[] = [];
  
  function formatDir(dirPath: string, indent: string): void {
    const items = tree.get(dirPath);
    if (!items) return;
    
    const sortedItems = Array.from(items).sort((a, b) => {
      // Directories first, then files
      const aIsDir = a.endsWith('/');
      const bIsDir = b.endsWith('/');
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });

    for (const item of sortedItems) {
      lines.push(indent + item);
      if (item.endsWith('/')) {
        const subPath = dirPath === '.' ? item.slice(0, -1) : `${dirPath}/${item.slice(0, -1)}`;
        formatDir(subPath, indent + '  ');
      }
    }
  }

  formatDir('.', '');
  return lines.join('\n');
}

/**
 * Download and extract a GitHub repository, saving all code to a single text file
 * 
 * @param repoUrl - GitHub repository URL or "owner/repo" format
 * @param options - Optional configuration
 * @returns Path to the saved output file
 */
export async function extractGitHubRepo(
  repoUrl: string,
  options: ExtractOptions = {}
): Promise<string> {
  const { branch = 'main', outputFileName } = options;
  const { owner, repo } = parseGitHubRepo(repoUrl);

  // Download ZIP from GitHub
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
  console.log(`Downloading ${owner}/${repo} (branch: ${branch})...`);

  const response = await fetch(zipUrl);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found or branch "${branch}" doesn't exist. Try specifying a different branch (e.g., "master").`);
    }
    throw new Error(`Failed to download repository: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log(`Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

  // Extract ZIP
  console.log('Extracting files...');
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Process files
  const files: FileEntry[] = [];
  const rootPrefix = `${repo}-${branch}/`;

  for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
    // Skip directories
    if (zipEntry.dir) continue;

    // Remove the root directory prefix (e.g., "repo-main/")
    let relativePath = zipPath;
    if (relativePath.startsWith(rootPrefix)) {
      relativePath = relativePath.slice(rootPrefix.length);
    } else {
      // Handle other common prefixes
      const slashIndex = relativePath.indexOf('/');
      if (slashIndex !== -1) {
        relativePath = relativePath.slice(slashIndex + 1);
      }
    }

    // Skip if path is empty after removing prefix
    if (!relativePath) continue;

    // Skip excluded files
    if (shouldExclude(relativePath)) continue;

    // Read file content
    const contentBuffer = await zipEntry.async('uint8array');

    // Skip binary files
    if (isBinaryContent(contentBuffer)) continue;

    // Decode as UTF-8
    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(contentBuffer);
      files.push({ path: relativePath, content });
    } catch {
      // Skip files that aren't valid UTF-8
      continue;
    }
  }

  // Sort files by path
  files.sort((a, b) => a.path.localeCompare(b.path));

  console.log(`Found ${files.length} text files`);

  // Build output content
  const separator = '='.repeat(100);
  const headerSeparator = '='.repeat(80);
  const timestamp = new Date().toISOString();

  let output = '';

  // Header
  output += `${headerSeparator}\n`;
  output += `REPOSITORY: ${owner}/${repo}\n`;
  output += `BRANCH: ${branch}\n`;
  output += `EXTRACTED: ${timestamp}\n`;
  output += `${headerSeparator}\n\n`;

  // Directory structure
  output += `DIRECTORY STRUCTURE:\n`;
  output += `${'─'.repeat(20)}\n`;
  output += buildDirectoryTree(files);
  output += '\n\n';

  // File contents header
  output += `${headerSeparator}\n`;
  output += `FILE CONTENTS\n`;
  output += `${headerSeparator}\n\n`;

  // Each file
  for (const file of files) {
    output += `${separator}\n`;
    output += `FILE: ${file.path}\n`;
    output += `${separator}\n`;
    output += file.content;
    // Ensure file ends with newline
    if (!file.content.endsWith('\n')) {
      output += '\n';
    }
    output += '\n';
  }

  // Determine output file name
  const finalFileName = outputFileName || `${repo}-codebase.txt`;
  const outputPath = path.join(process.cwd(), finalFileName);

  // Write to file
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`Saved to: ${outputPath}`);

  return outputPath;
}

/**
 * Extract GitHub repository content and return as a string (without saving to file)
 * 
 * @param repoUrl - GitHub repository URL or "owner/repo" format
 * @param options - Optional configuration
 * @returns The extracted content as a string
 */
export async function extractGitHubRepoContent(
  repoUrl: string,
  options: ExtractContentOptions = {}
): Promise<{ content: string; repo: string; owner: string; fileCount: number }> {
  const { branch = 'main' } = options;
  const { owner, repo } = parseGitHubRepo(repoUrl);

  // Download ZIP from GitHub
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

  const response = await fetch(zipUrl);
  if (!response.ok) {
    if (response.status === 404) {
      // Try with master branch if main fails
      if (branch === 'main') {
        return extractGitHubRepoContent(repoUrl, { branch: 'master' });
      }
      throw new Error(`Repository not found or branch "${branch}" doesn't exist.`);
    }
    throw new Error(`Failed to download repository: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Extract ZIP
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Process files
  const files: FileEntry[] = [];
  const rootPrefix = `${repo}-${branch}/`;

  for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    let relativePath = zipPath;
    if (relativePath.startsWith(rootPrefix)) {
      relativePath = relativePath.slice(rootPrefix.length);
    } else {
      const slashIndex = relativePath.indexOf('/');
      if (slashIndex !== -1) {
        relativePath = relativePath.slice(slashIndex + 1);
      }
    }

    if (!relativePath) continue;
    if (shouldExclude(relativePath)) continue;

    const contentBuffer = await zipEntry.async('uint8array');
    if (isBinaryContent(contentBuffer)) continue;

    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(contentBuffer);
      files.push({ path: relativePath, content });
    } catch {
      continue;
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  // Build output content
  const separator = '='.repeat(100);
  const headerSeparator = '='.repeat(80);
  const timestamp = new Date().toISOString();

  let output = '';

  output += `${headerSeparator}\n`;
  output += `REPOSITORY: ${owner}/${repo}\n`;
  output += `BRANCH: ${branch}\n`;
  output += `EXTRACTED: ${timestamp}\n`;
  output += `${headerSeparator}\n\n`;

  output += `DIRECTORY STRUCTURE:\n`;
  output += `${'─'.repeat(20)}\n`;
  output += buildDirectoryTree(files);
  output += '\n\n';

  output += `${headerSeparator}\n`;
  output += `FILE CONTENTS\n`;
  output += `${headerSeparator}\n\n`;

  for (const file of files) {
    output += `${separator}\n`;
    output += `FILE: ${file.path}\n`;
    output += `${separator}\n`;
    output += file.content;
    if (!file.content.endsWith('\n')) {
      output += '\n';
    }
    output += '\n';
  }

  return { content: output, repo, owner, fileCount: files.length };
}

