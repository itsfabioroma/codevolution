import { promises as fs } from 'fs';
import path from 'path';
import type { FilePattern, DEFAULT_EXCLUDE_PATTERNS } from './types';

export interface ScannedFile {
    path: string;
    relativePath: string;
    content: string;
    language: string;
    lineCount: number;
    size: number;
}

// scan directory recursively with regex pattern matching
export async function scanDirectory(
    rootPath: string,
    includePatterns: RegExp[],
    excludePatterns: RegExp[]
): Promise<ScannedFile[]> {
    const files: ScannedFile[] = [];

    async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(rootPath, fullPath);

            // check exclude patterns
            const isExcluded = excludePatterns.some((p) => p.test(relativePath));
            if (isExcluded) continue;

            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                // check include patterns
                const isIncluded = includePatterns.some((p) => p.test(relativePath));
                if (!isIncluded) continue;

                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const language = detectLanguage(relativePath);

                    files.push({
                        path: fullPath,
                        relativePath,
                        content,
                        language,
                        lineCount: content.split('\n').length,
                        size: Buffer.byteLength(content, 'utf-8'),
                    });
                } catch (err) {
                    // skip files that can't be read
                    console.warn(`Failed to read ${fullPath}:`, err);
                }
            }
        }
    }

    await walk(rootPath);
    return files;
}

// detect language from file extension
function detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const langMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.rs': 'rust',
        '.go': 'go',
        '.java': 'java',
        '.rb': 'ruby',
        '.php': 'php',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.vue': 'vue',
        '.svelte': 'svelte',
    };

    return langMap[ext] || 'unknown';
}

// parse patterns from string array to RegExp array
export function parsePatterns(patterns: string[]): RegExp[] {
    return patterns.map((p) => {
        // if already looks like regex (has special chars), use as-is
        if (/[.*+?^${}()|[\]\\]/.test(p)) {
            return new RegExp(p);
        }
        // otherwise treat as glob-like pattern
        const regexStr = p
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(regexStr);
    });
}

// chunk files for parallel subagent processing
// each subagent gets exactly ONE file (as per requirement)
export function distributeFilesToSubagents(
    files: ScannedFile[],
    maxConcurrent: number
): ScannedFile[][] {
    // create batches where each batch has up to maxConcurrent files
    // but each subagent within a batch gets exactly 1 file
    const batches: ScannedFile[][] = [];

    for (let i = 0; i < files.length; i += maxConcurrent) {
        batches.push(files.slice(i, i + maxConcurrent));
    }

    return batches;
}

// generate file tree structure for context
export function generateFileTree(files: ScannedFile[]): string {
    const tree: Record<string, string[]> = {};

    for (const file of files) {
        const dir = path.dirname(file.relativePath);
        if (!tree[dir]) tree[dir] = [];
        tree[dir].push(path.basename(file.relativePath));
    }

    const lines: string[] = [];
    const sortedDirs = Object.keys(tree).sort();

    for (const dir of sortedDirs) {
        lines.push(`📁 ${dir || '.'}/`);
        for (const file of tree[dir].sort()) {
            lines.push(`   └── ${file}`);
        }
    }

    return lines.join('\n');
}
