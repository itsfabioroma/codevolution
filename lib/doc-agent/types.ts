// doc agent node status
export type DocNodeStatus = 'pending' | 'scanning' | 'documenting' | 'completed' | 'error';

// single file documentation node
export interface DocNode {
    id: string;
    filePath: string;
    status: DocNodeStatus;

    // file info
    content: string;
    language: string;
    lineCount: number;

    // generated docs
    summary?: string;
    exports?: string[];
    dependencies?: string[];
    documentation?: string;

    // timing
    startedAt: number;
    completedAt?: number;
    error?: string;
}

// full doc tree state
export interface DocTreeState {
    nodes: DocNode[];
    status: 'idle' | 'scanning' | 'documenting' | 'completed' | 'error';
    projectSummary?: string;
    error?: string;
}

// SSE events for real-time updates
export type DocEvent =
    | { type: 'scan:start'; pattern: string }
    | { type: 'scan:file'; filePath: string }
    | { type: 'scan:complete'; fileCount: number }
    | { type: 'node:created'; node: DocNode }
    | { type: 'node:status'; nodeId: string; status: DocNodeStatus }
    | { type: 'node:documented'; nodeId: string; documentation: string }
    | { type: 'node:error'; nodeId: string; error: string }
    | { type: 'summary:start' }
    | { type: 'summary:complete'; summary: string }
    | { type: 'execution:complete'; result: DocTreeState }
    | { type: 'execution:error'; error: string };

// file pattern config for subagent distribution
export interface FilePattern {
    pattern: RegExp;
    language: string;
    description: string;
}

// request body for /api/docs/generate
export interface DocGenerateRequest {
    rootPath: string;
    patterns?: string[];           // regex patterns, default: common code files
    excludePatterns?: string[];    // patterns to exclude
    maxConcurrent?: number;        // max parallel subagents (default: 5)
    includeContent?: boolean;      // include file content in output
    outputPath?: string;           // path to write .md file (default: rootPath/DOCS.md)
}

// default file patterns
export const DEFAULT_FILE_PATTERNS: FilePattern[] = [
    { pattern: /\.tsx?$/, language: 'typescript', description: 'TypeScript files' },
    { pattern: /\.jsx?$/, language: 'javascript', description: 'JavaScript files' },
    { pattern: /\.py$/, language: 'python', description: 'Python files' },
    { pattern: /\.rs$/, language: 'rust', description: 'Rust files' },
    { pattern: /\.go$/, language: 'go', description: 'Go files' },
];

// default exclude patterns
export const DEFAULT_EXCLUDE_PATTERNS = [
    /node_modules/,
    /\.next/,
    /\.git/,
    /dist/,
    /build/,
    /\.d\.ts$/,
    /\.test\./,
    /\.spec\./,
];
