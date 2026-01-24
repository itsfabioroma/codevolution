import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { nanoid } from 'nanoid';
import type { RLMEvent, RLMNode } from '@/lib/rlm/types';
import { createRLMSandbox } from '@/lib/rlm/daytona-client';
import { RLM_DOC_PROMPT } from '@/lib/doc-agent/doc-prompt';
import {
    scanDirectory,
    parsePatterns,
    generateFileTree,
} from '@/lib/doc-agent/file-scanner';
import { DEFAULT_EXCLUDE_PATTERNS } from '@/lib/doc-agent/types';

interface DocRLMRequest {
    rootPath: string;
    patterns?: string[];
    excludePatterns?: string[];
    maxDepth?: number;
}

// SSE encoder
function encodeSSE(event: RLMEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
    const body: DocRLMRequest = await req.json();
    const {
        rootPath,
        patterns = ['\\.tsx?$', '\\.jsx?$', '\\.py$'],
        excludePatterns = [],
        maxDepth = 2,
    } = body;

    // parse patterns
    const includeRegexes = parsePatterns(patterns);
    const excludeRegexes = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...parsePatterns(excludePatterns),
    ];

    // create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: RLMEvent) => {
                controller.enqueue(encoder.encode(encodeSSE(event)));
            };

            try {
                // STEP 1: scan files
                const files = await scanDirectory(rootPath, includeRegexes, excludeRegexes);
                const fileTree = generateFileTree(files);

                if (files.length === 0) {
                    sendEvent({ type: 'execution:error', error: 'No files matched patterns' });
                    controller.close();
                    return;
                }

                // build context for RLM
                // each file is an individual item for subagent delegation
                const contextData = {
                    projectRoot: rootPath,
                    fileTree,
                    files: files.map((f) => ({
                        path: f.relativePath,
                        content: f.content,
                        language: f.language,
                        lineCount: f.lineCount,
                    })),
                };
                const context = JSON.stringify(contextData);

                // STEP 2: create root node
                const rootNodeId = nanoid(8);
                const rootNode: RLMNode = {
                    id: rootNodeId,
                    parentId: null,
                    depth: 0,
                    status: 'executing',
                    code: '',
                    output: '',
                    contextId: 'doc-gen',
                    startedAt: Date.now(),
                };
                sendEvent({ type: 'node:created', node: rootNode });

                // STEP 3: generate orchestration code
                sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'llm-calling' });

                const codegenPrompt = `${RLM_DOC_PROMPT}

## Your Task
Generate documentation for this codebase.

## Context Stats
- Total files: ${files.length}
- File tree:
\`\`\`
${fileTree}
\`\`\`

## CRITICAL
- Each llm_query call must document exactly ONE file
- Use llm_query_batch for parallel processing
- The context variable contains JSON with all files
- Extract each file and send to subagent with its content

Write Python code to:
1. Parse the files from context JSON
2. Build prompts (one per file with full content)
3. Call llm_query_batch to document all files in parallel
4. Aggregate results
5. FINAL() the complete documentation`;

                const llmResult = await generateText({
                    model: anthropic('claude-opus-4-5-20251101'),
                    prompt: codegenPrompt,
                    maxOutputTokens: 4096,
                    providerOptions: {
                        anthropic: {
                            thinking: { type: 'enabled', budgetTokens: 4000 },
                        } satisfies AnthropicProviderOptions,
                    },
                });

                const generatedCode = extractPythonCode(llmResult.text);
                sendEvent({ type: 'node:llm-end', nodeId: rootNodeId, response: generatedCode });
                sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'executing' });

                // STEP 4: execute in sandbox
                const sandbox = await createRLMSandbox(
                    rootNodeId,
                    'doc-gen',
                    context,
                    sendEvent
                );

                try {
                    // llm handler for subagents
                    const createLlmHandler = (currentDepth: number) => {
                        return async (subPrompt: string, childNodeId: string): Promise<string> => {
                            const childDepth = currentDepth + 1;

                            sendEvent({
                                type: 'node:output',
                                nodeId: childNodeId,
                                output: `[subagent] Documenting file...`,
                            });

                            // each subagent just answers (no recursion for docs)
                            const result = await generateText({
                                model: anthropic('claude-sonnet-4-20250514'),
                                prompt: subPrompt,
                                maxOutputTokens: 2048,
                            });

                            return result.text;
                        };
                    };

                    const result = await sandbox.executeWithLlmSupport(
                        generatedCode,
                        createLlmHandler(0)
                    );

                    if (result.finalResult) {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'completed' });
                        sendEvent({ type: 'execution:complete', result: result.finalResult });
                    } else if (result.error) {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'error' });
                        sendEvent({ type: 'execution:error', error: result.error });
                    } else {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'completed' });
                        sendEvent({
                            type: 'execution:complete',
                            result: result.output || 'No documentation generated',
                        });
                    }
                } finally {
                    await sandbox.close();
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                sendEvent({ type: 'execution:error', error: errorMsg });
            }

            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}

// extract Python code from LLM response
function extractPythonCode(text: string): string {
    const codeBlockMatch = text.match(/```python\n([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    const genericBlockMatch = text.match(/```\n([\s\S]*?)```/);
    if (genericBlockMatch) return genericBlockMatch[1].trim();

    const lines = text.split('\n');
    const codeStart = lines.findIndex(
        (line) =>
            line.startsWith('import ') ||
            line.startsWith('from ') ||
            line.startsWith('#') ||
            line.startsWith('def ')
    );

    if (codeStart >= 0) return lines.slice(codeStart).join('\n').trim();
    return text.trim();
}
