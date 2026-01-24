import { Sandbox } from '@e2b/code-interpreter';
import { nanoid } from 'nanoid';
import type { RLMEvent, RLMNode } from './types';

// result of code execution
export interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    finalResult?: string;
}

// callback for streaming events
export type EventCallback = (event: RLMEvent) => void;

// callback for LLM queries - returns response
export type LLMQueryHandler = (prompt: string, childNodeId: string) => Promise<string>;

// RLM sandbox wrapper
export class RLMSandbox {
    private sandbox: Sandbox | null = null;
    private parentNodeId: string;
    private contextId: string;
    private eventCallback: EventCallback;
    private currentDepth: number;
    private queryCounter = 0;

    constructor(parentNodeId: string, contextId: string, eventCallback: EventCallback, currentDepth: number = 0) {
        this.parentNodeId = parentNodeId;
        this.contextId = contextId;
        this.eventCallback = eventCallback;
        this.currentDepth = currentDepth;
    }

    // init sandbox with RLM runtime
    async initialize(context: string): Promise<void> {
        this.sandbox = await Sandbox.create();

        // escape context for Python string
        const escapedContext = JSON.stringify(context);

        // inject RLM runtime - uses markers instead of HTTP callbacks
        const runtimeCode = `
import json

# context variable
context = ${escapedContext}

# state
_rlm_final_result = None
_rlm_finished = False

def llm_query(prompt: str) -> str:
    """Call sub-LLM. Blocks until response is provided."""
    print(f"__LLM_QUERY_START__")
    print(prompt)
    print(f"__LLM_QUERY_END__")
    raise RuntimeError("LLM_QUERY_PENDING")

def llm_query_batch(prompts: list) -> list:
    """Call multiple sub-LLMs IN PARALLEL. Much faster for many queries."""
    print(f"__LLM_BATCH_START__")
    print(json.dumps(prompts))
    print(f"__LLM_BATCH_END__")
    raise RuntimeError("LLM_BATCH_PENDING")

def FINAL(result: str) -> None:
    """Return final result and terminate."""
    global _rlm_final_result, _rlm_finished
    _rlm_final_result = str(result)
    _rlm_finished = True
    print(f"__RLM_FINAL_START__")
    print(_rlm_final_result)
    print(f"__RLM_FINAL_END__")

def FINAL_VAR(var_name: str) -> None:
    """Return variable value as final result."""
    global _rlm_final_result, _rlm_finished
    _rlm_final_result = str(eval(var_name))
    _rlm_finished = True
    print(f"__RLM_FINAL_START__")
    print(_rlm_final_result)
    print(f"__RLM_FINAL_END__")

print("RLM runtime initialized")
print(f"Context length: {len(context)} chars")
`;

        await this.sandbox.runCode(runtimeCode);
    }

    // execute code with sub-node creation for llm_query calls
    async executeWithLlmSupport(
        code: string,
        llmQueryHandler: LLMQueryHandler
    ): Promise<ExecutionResult> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        let fullOutput = '';
        let currentCode = code;
        let iteration = 0;
        const maxIterations = 100; // allow more iterations for multiple llm_query calls

        while (iteration < maxIterations) {
            iteration++;

            let output = '';
            let error: string | undefined;

            try {
                const execution = await this.sandbox.runCode(currentCode, {
                    onStdout: (msg) => {
                        const text = msg.line || '';
                        output += text + '\n';
                    },
                    onStderr: (msg) => {
                        const text = msg.line || '';
                        output += `[stderr] ${text}\n`;
                    },
                });

                if (execution.error) {
                    error = execution.error.name + ': ' + execution.error.value;
                }
            } catch (e) {
                error = e instanceof Error ? e.message : String(e);
            }

            fullOutput += output;

            // stream output to root node (filter out markers)
            if (output.trim() && !output.includes('__LLM_QUERY_') && !output.includes('__LLM_BATCH_')) {
                this.eventCallback({
                    type: 'node:output',
                    nodeId: this.parentNodeId,
                    output: output.replace(/__LLM_QUERY_START__|__LLM_QUERY_END__|__LLM_BATCH_START__|__LLM_BATCH_END__|__RLM_FINAL_START__|__RLM_FINAL_END__/g, '').trim(),
                });
            }

            // check for BATCH query marker (parallel execution)
            const batchMatch = output.match(/__LLM_BATCH_START__\n([\s\S]*?)\n__LLM_BATCH_END__/);
            if (batchMatch) {
                const prompts: string[] = JSON.parse(batchMatch[1].trim());

                // Anthropic rate limits - conservative to avoid bursts
                // Tier 3: 2000 RPM, 800k ITPM, 160k OTPM
                // But token limits hit faster with Opus + extended thinking
                const MAX_PARALLEL = 10; // conservative
                const STAGGER_MS = 100; // 100ms between each request
                const BATCH_DELAY_MS = 2000; // 2s pause between batches

                this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: `Processing ${prompts.length} queries (${MAX_PARALLEL} at a time, throttled)...` });

                // LAZY node creation - only create nodes when processing them
                const responses: string[] = [];
                for (let i = 0; i < prompts.length; i += MAX_PARALLEL) {
                    const batchPrompts = prompts.slice(i, i + MAX_PARALLEL);

                    // create nodes for THIS batch only (lazy)
                    const batch = batchPrompts.map((prompt) => {
                        const childNodeId = nanoid(8);
                        const childNode: RLMNode = {
                            id: childNodeId,
                            parentId: this.parentNodeId,
                            depth: this.currentDepth + 1,
                            status: 'llm-calling',
                            code: '',
                            output: '',
                            llmPrompt: prompt,
                            contextId: this.contextId,
                            startedAt: Date.now(),
                        };
                        this.eventCallback({ type: 'node:created', node: childNode });
                        this.eventCallback({ type: 'node:llm-start', nodeId: childNodeId, prompt });
                        return { nodeId: childNodeId, prompt };
                    });

                    // run batch with staggered starts (avoid burst)
                    const batchResponses = await Promise.all(
                        batch.map(async ({ nodeId, prompt }, idx) => {
                            if (idx > 0) await new Promise(r => setTimeout(r, idx * STAGGER_MS));
                            const response = await llmQueryHandler(prompt, nodeId);
                            this.eventCallback({ type: 'node:llm-end', nodeId, response });
                            this.eventCallback({ type: 'node:status', nodeId, status: 'completed' });
                            return response;
                        })
                    );
                    responses.push(...batchResponses);

                    this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: `Completed ${Math.min(i + MAX_PARALLEL, prompts.length)}/${prompts.length}` });

                    // pause between batches to respect rate limits
                    const hasMoreBatches = i + MAX_PARALLEL < prompts.length;
                    if (hasMoreBatches) {
                        this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: `Cooling down ${BATCH_DELAY_MS}ms...` });
                        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
                    }
                }

                // build cache for all responses
                const cacheEntries = prompts.map((prompt, i) =>
                    `_llm_cache[${JSON.stringify(prompt)}] = ${JSON.stringify(responses[i])}`
                ).join('\n');

                const cacheCode = `
import json
_llm_cache = getattr(__builtins__, '_llm_cache', {}) if hasattr(__builtins__, '_llm_cache') else {}
${cacheEntries}
__builtins__._llm_cache = _llm_cache

def llm_query(prompt: str) -> str:
    if prompt in _llm_cache:
        return _llm_cache[prompt]
    print(f"__LLM_QUERY_START__")
    print(prompt)
    print(f"__LLM_QUERY_END__")
    raise RuntimeError("LLM_QUERY_PENDING")

def llm_query_batch(prompts: list) -> list:
    # check if all cached
    results = []
    missing = []
    for p in prompts:
        if p in _llm_cache:
            results.append(_llm_cache[p])
        else:
            missing.append(p)
    if missing:
        print(f"__LLM_BATCH_START__")
        print(json.dumps(missing))
        print(f"__LLM_BATCH_END__")
        raise RuntimeError("LLM_BATCH_PENDING")
    return results

${code}
`;
                currentCode = cacheCode;
                continue;
            }

            // check for single LLM query marker
            const queryMatch = output.match(/__LLM_QUERY_START__\n([\s\S]*?)\n__LLM_QUERY_END__/);
            if (queryMatch) {
                const pendingQuery = queryMatch[1].trim();
                this.queryCounter++;

                // CREATE CHILD NODE for this llm_query call
                const childNodeId = nanoid(8);
                const childNode: RLMNode = {
                    id: childNodeId,
                    parentId: this.parentNodeId,
                    depth: this.currentDepth + 1,
                    status: 'llm-calling',
                    code: '',
                    output: '',
                    llmPrompt: pendingQuery,
                    contextId: this.contextId,
                    startedAt: Date.now(),
                };

                // emit child node creation
                this.eventCallback({ type: 'node:created', node: childNode });
                this.eventCallback({ type: 'node:llm-start', nodeId: childNodeId, prompt: pendingQuery });

                // call LLM handler
                const llmResponse = await llmQueryHandler(pendingQuery, childNodeId);

                // emit child node completion
                this.eventCallback({ type: 'node:llm-end', nodeId: childNodeId, response: llmResponse });
                this.eventCallback({ type: 'node:status', nodeId: childNodeId, status: 'completed' });

                // inject response into cache and re-run
                const escapedResponse = JSON.stringify(llmResponse);
                const cacheCode = `
import json
_llm_cache = getattr(__builtins__, '_llm_cache', {}) if hasattr(__builtins__, '_llm_cache') else {}
_llm_cache[${JSON.stringify(pendingQuery)}] = ${escapedResponse}
__builtins__._llm_cache = _llm_cache

def llm_query(prompt: str) -> str:
    if prompt in _llm_cache:
        return _llm_cache[prompt]
    print(f"__LLM_QUERY_START__")
    print(prompt)
    print(f"__LLM_QUERY_END__")
    raise RuntimeError("LLM_QUERY_PENDING")

def llm_query_batch(prompts: list) -> list:
    results = []
    missing = []
    for p in prompts:
        if p in _llm_cache:
            results.append(_llm_cache[p])
        else:
            missing.append(p)
    if missing:
        print(f"__LLM_BATCH_START__")
        print(json.dumps(missing))
        print(f"__LLM_BATCH_END__")
        raise RuntimeError("LLM_BATCH_PENDING")
    return results

${code}
`;
                currentCode = cacheCode;
                continue;
            }

            // check for FINAL marker
            const finalMatch = output.match(/__RLM_FINAL_START__\n([\s\S]*?)\n__RLM_FINAL_END__/);
            if (finalMatch) {
                return {
                    success: true,
                    output: fullOutput,
                    finalResult: finalMatch[1].trim(),
                };
            }

            // check for pending LLM errors (continue re-running with cache)
            if (error?.includes('LLM_QUERY_PENDING') || error?.includes('LLM_BATCH_PENDING')) {
                continue;
            }

            // if error, return it
            if (error) {
                this.eventCallback({
                    type: 'node:error',
                    nodeId: this.parentNodeId,
                    error,
                });
                return {
                    success: false,
                    output: fullOutput,
                    error,
                };
            }

            // completed without FINAL
            return {
                success: true,
                output: fullOutput,
                finalResult: fullOutput.trim() || 'Execution completed (no FINAL() called)',
            };
        }

        return {
            success: false,
            output: fullOutput,
            error: 'Max iterations exceeded',
        };
    }

    async close(): Promise<void> {
        if (this.sandbox) {
            await this.sandbox.kill();
            this.sandbox = null;
        }
    }
}

// create a new RLM sandbox
export async function createRLMSandbox(
    parentNodeId: string,
    contextId: string,
    context: string,
    eventCallback: EventCallback,
    currentDepth: number = 0
): Promise<RLMSandbox> {
    const sandbox = new RLMSandbox(parentNodeId, contextId, eventCallback, currentDepth);
    await sandbox.initialize(context);
    return sandbox;
}
