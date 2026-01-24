import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { UltraContext } from 'ultracontext';
import { nanoid } from 'nanoid';
import type { RLMExecuteRequest, RLMEvent, RLMNode } from '@/lib/rlm/types';
import { buildRLMPrompt, RLM_SUB_PROMPT } from '@/lib/rlm/rlm-prompt';
import { createRLMSandbox } from '@/lib/rlm/e2b-client';

// SSE encoder
function encodeSSE(event: RLMEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
    const body: RLMExecuteRequest = await req.json();
    const { query, context, contextId: existingContextId, maxDepth = 1 } = body;

    // init UC client
    const apiKey = process.env.ULTRACONTEXT_API_KEY;
    if (!apiKey) throw new Error('Missing ULTRACONTEXT_API_KEY');
    const uc = new UltraContext({ apiKey });

    // create or use existing context
    let rootContextId = existingContextId;
    if (!rootContextId) {
        const newContext = await uc.create({
            metadata: { name: `RLM: ${query.slice(0, 30)}...` },
        });
        rootContextId = newContext.id;
    }

    // create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // helper to send events
            const sendEvent = (event: RLMEvent) => {
                controller.enqueue(encoder.encode(encodeSSE(event)));
            };

            try {
                // STEP 1: create root node
                const rootNodeId = nanoid(8);
                const rootNode: RLMNode = {
                    id: rootNodeId,
                    parentId: null,
                    depth: 0,
                    status: 'executing',
                    code: '',
                    output: '',
                    contextId: rootContextId!,
                    startedAt: Date.now(),
                };
                sendEvent({ type: 'node:created', node: rootNode });

                // STEP 2: call root LLM to generate Python code
                sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'llm-calling' });
                sendEvent({ type: 'node:llm-start', nodeId: rootNodeId, prompt: query });

                const prompt = buildRLMPrompt(query);

                // prepend context preview
                const contextPreview = context.slice(0, 5000);
                const fullPrompt = `${prompt}

## Context Preview (first 5000 chars)
\`\`\`
${contextPreview}
\`\`\`

## Full Context Stats
- Total length: ${context.length} characters
- Total lines: ${context.split('\n').length}
- Max recursion depth: ${maxDepth} (sub-agents ${maxDepth > 1 ? 'CAN' : 'cannot'} spawn their own sub-agents)

Now write Python code to solve the query. Remember: the full context is available as the \`context\` variable.`;

                const llmResult = await generateText({
                    model: anthropic('claude-opus-4-5-20251101'),
                    prompt: fullPrompt,
                    maxOutputTokens: 8192,
                    providerOptions: {
                        anthropic: {
                            thinking: { type: 'enabled', budgetTokens: 8000 },
                        } satisfies AnthropicProviderOptions,
                    },
                });

                const generatedCode = extractPythonCode(llmResult.text);
                sendEvent({ type: 'node:llm-end', nodeId: rootNodeId, response: generatedCode });
                sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'executing' });

                // STEP 3: execute code in E2B sandbox with LLM support
                const sandbox = await createRLMSandbox(rootNodeId, rootContextId!, context, sendEvent);

                try {
                    // recursive llm_query handler - can spawn sub-agents if depth allows
                    const createLlmHandler = (currentDepth: number): ((prompt: string, childNodeId: string) => Promise<string>) => {
                        return async (subPrompt: string, childNodeId: string): Promise<string> => {
                            const childDepth = currentDepth + 1;

                            // if we haven't reached max depth, sub-agent generates and EXECUTES code
                            if (childDepth < maxDepth) {
                                sendEvent({
                                    type: 'node:output',
                                    nodeId: childNodeId,
                                    output: `[depth ${childDepth}] Generating Python code (can spawn sub-agents)...`,
                                });

                                // sub-agent gets RLM prompt
                                const subRlmPrompt = buildRLMPrompt(subPrompt);
                                const subResult = await generateText({
                                    model: anthropic('claude-opus-4-5-20251101'),
                                    prompt: `${subRlmPrompt}

## Sub-agent Context
You are a sub-agent at depth ${childDepth}/${maxDepth}.
You CAN spawn your own sub-agents using llm_query() or llm_query_batch().
The context variable contains: ${subPrompt.slice(0, 500)}...

Write Python code to solve this and call FINAL() with your answer.`,
                                    maxOutputTokens: 4096,
                                });

                                const subCode = extractPythonCode(subResult.text);
                                const codeLines = subCode.split('\n').length;

                                sendEvent({
                                    type: 'node:output',
                                    nodeId: childNodeId,
                                    output: `[depth ${childDepth}] Generated ${codeLines} lines, creating sandbox...`,
                                });

                                // EXECUTE sub-agent code in nested sandbox
                                const subSandbox = await createRLMSandbox(
                                    childNodeId,
                                    rootContextId!,
                                    subPrompt,
                                    sendEvent,
                                    childDepth
                                );

                                try {
                                    sendEvent({
                                        type: 'node:output',
                                        nodeId: childNodeId,
                                        output: `[depth ${childDepth}] Executing code in sandbox...`,
                                    });

                                    const subExecResult = await subSandbox.executeWithLlmSupport(
                                        subCode,
                                        createLlmHandler(childDepth)
                                    );

                                    sendEvent({
                                        type: 'node:output',
                                        nodeId: childNodeId,
                                        output: `[depth ${childDepth}] Execution complete`,
                                    });

                                    return `[Code executed]\n${subExecResult.finalResult || subExecResult.output || 'No result'}`;
                                } finally {
                                    await subSandbox.close();
                                }
                            }

                            // at max depth, just answer directly (no code generation)
                            sendEvent({
                                type: 'node:output',
                                nodeId: childNodeId,
                                output: `[depth ${childDepth}] Max depth reached, answering directly...`,
                            });

                            const subResult = await generateText({
                                model: anthropic('claude-opus-4-5-20251101'),
                                system: RLM_SUB_PROMPT,
                                prompt: subPrompt,
                                maxOutputTokens: 4096,
                            });

                            return subResult.text;
                        };
                    };

                    const result = await sandbox.executeWithLlmSupport(generatedCode, createLlmHandler(0));

                    if (result.finalResult) {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'completed' });
                        sendEvent({ type: 'execution:complete', result: result.finalResult });

                        await uc.append(rootContextId!, [
                            {
                                type: 'rlm-execution',
                                query,
                                code: generatedCode,
                                output: result.output,
                                result: result.finalResult,
                            },
                        ]);
                    } else if (result.error) {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'error' });
                        sendEvent({ type: 'execution:error', error: result.error });
                    } else {
                        sendEvent({ type: 'node:status', nodeId: rootNodeId, status: 'completed' });
                        sendEvent({
                            type: 'execution:complete',
                            result: result.output || 'Execution completed (no FINAL() called)',
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
    // try to find code block
    const codeBlockMatch = text.match(/```python\n([\s\S]*?)```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }

    // try generic code block
    const genericBlockMatch = text.match(/```\n([\s\S]*?)```/);
    if (genericBlockMatch) {
        return genericBlockMatch[1].trim();
    }

    // if no code block, assume entire response is code (after any prose)
    const lines = text.split('\n');
    const codeStart = lines.findIndex(
        (line) =>
            line.startsWith('import ') ||
            line.startsWith('from ') ||
            line.startsWith('#') ||
            line.startsWith('context') ||
            line.startsWith('def ') ||
            line.startsWith('for ') ||
            line.startsWith('while ')
    );

    if (codeStart >= 0) {
        return lines.slice(codeStart).join('\n').trim();
    }

    return text.trim();
}
