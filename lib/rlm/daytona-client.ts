import { Daytona, Sandbox } from '@daytonaio/sdk';
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

// singleton daytona client and sandbox
const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
    target: (process.env.DAYTONA_TARGET || 'us') as 'us' | 'eu',
});
let sharedSandbox: Sandbox | null = null;

// get or create shared sandbox with retry
async function getSharedSandbox(): Promise<Sandbox> {
    if (sharedSandbox) return sharedSandbox;

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Daytona] Creating sandbox (attempt ${attempt}/${maxRetries})...`);
            sharedSandbox = await daytona.create({ language: 'python' });
            console.log('[Daytona] Sandbox ready:', sharedSandbox.id);
            return sharedSandbox;
        } catch (error) {
            console.error(`[Daytona] Attempt ${attempt} failed:`, error);
            if (attempt === maxRetries) throw error;
            await new Promise(r => setTimeout(r, 2000 * attempt)); // exponential backoff
        }
    }
    throw new Error('Failed to create sandbox');
}

// RLM sandbox wrapper
export class RLMSandbox {
    private sandbox: Sandbox | null = null;
    private parentNodeId: string;
    private contextId: string;
    private eventCallback: EventCallback;
    private currentDepth: number;
    private runtimePrefix: string = '';

    constructor(parentNodeId: string, contextId: string, eventCallback: EventCallback, currentDepth: number = 0) {
        this.parentNodeId = parentNodeId;
        this.contextId = contextId;
        this.eventCallback = eventCallback;
        this.currentDepth = currentDepth;
    }

    async initialize(context: string): Promise<void> {
        this.sandbox = await getSharedSandbox();

        // build runtime prefix that gets prepended to every execution
        const escapedContext = JSON.stringify(context);
        this.runtimePrefix = `
import json
import sys

context = ${escapedContext}

def llm_query(prompt):
    if '_llm_cache' in globals() and prompt in _llm_cache:
        return _llm_cache[prompt]
    print("__LLM_QUERY_START__")
    print(prompt)
    print("__LLM_QUERY_END__")
    sys.exit(42)

def llm_query_batch(prompts):
    if '_llm_cache' in globals():
        missing = [p for p in prompts if p not in _llm_cache]
        if not missing:
            return [_llm_cache[p] for p in prompts]
        prompts = missing
    print("__LLM_BATCH_START__")
    print(json.dumps(prompts))
    print("__LLM_BATCH_END__")
    sys.exit(43)

def FINAL(result):
    print("__RLM_FINAL_START__")
    print(str(result))
    print("__RLM_FINAL_END__")

`;
        console.log('[Daytona] Runtime initialized, context:', context.length, 'chars');
    }

    async executeWithLlmSupport(code: string, llmQueryHandler: LLMQueryHandler): Promise<ExecutionResult> {
        if (!this.sandbox) throw new Error('Not initialized');

        let fullOutput = '';
        let currentCode = code;
        let iteration = 0;

        while (iteration < 100) {
            iteration++;
            console.log(`[Daytona] Iteration ${iteration}`);

            // run code with runtime prefix
            const fullCode = this.runtimePrefix + currentCode;
            const result = await this.sandbox.process.codeRun(fullCode, undefined, 300000);
            const output = result.result || '';
            const exitCode = result.exitCode;

            console.log(`[Daytona] Exit: ${exitCode}, Output: ${output.length} chars`);
            fullOutput += output;

            // stream clean output
            const cleanOutput = output.replace(/__LLM_.*?__|__RLM_.*?__/g, '').trim();
            if (cleanOutput && !output.includes('__LLM_')) {
                this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: cleanOutput });
            }

            // check FINAL
            const finalMatch = output.match(/__RLM_FINAL_START__\n([\s\S]*?)\n__RLM_FINAL_END__/);
            if (finalMatch) {
                return { success: true, output: fullOutput, finalResult: finalMatch[1].trim() };
            }

            // check batch LLM query
            const batchMatch = output.match(/__LLM_BATCH_START__\n([\s\S]*?)\n__LLM_BATCH_END__/);
            if (batchMatch) {
                const prompts: string[] = JSON.parse(batchMatch[1].trim());
                this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: `Processing ${prompts.length} queries...` });

                const responses: string[] = [];
                for (let i = 0; i < prompts.length; i += 10) {
                    const batch = prompts.slice(i, i + 10).map(prompt => {
                        const nodeId = nanoid(8);
                        this.eventCallback({ type: 'node:created', node: { id: nodeId, parentId: this.parentNodeId, depth: this.currentDepth + 1, status: 'llm-calling', code: '', output: '', llmPrompt: prompt, contextId: this.contextId, startedAt: Date.now() } as RLMNode });
                        return { nodeId, prompt };
                    });

                    const results = await Promise.all(batch.map(async ({ nodeId, prompt }, idx) => {
                        if (idx > 0) await new Promise(r => setTimeout(r, idx * 100));
                        const resp = await llmQueryHandler(prompt, nodeId);
                        this.eventCallback({ type: 'node:status', nodeId, status: 'completed' });
                        return resp;
                    }));
                    responses.push(...results);

                    this.eventCallback({ type: 'node:output', nodeId: this.parentNodeId, output: `${Math.min(i + 10, prompts.length)}/${prompts.length}` });
                    if (i + 10 < prompts.length) await new Promise(r => setTimeout(r, 2000));
                }

                const cache = prompts.map((p, i) => `_llm_cache[${JSON.stringify(p)}] = ${JSON.stringify(responses[i])}`).join('\n');
                currentCode = `_llm_cache = {}\n${cache}\n${code}`;
                continue;
            }

            // check single LLM query
            const queryMatch = output.match(/__LLM_QUERY_START__\n([\s\S]*?)\n__LLM_QUERY_END__/);
            if (queryMatch) {
                const prompt = queryMatch[1].trim();
                const nodeId = nanoid(8);
                this.eventCallback({ type: 'node:created', node: { id: nodeId, parentId: this.parentNodeId, depth: this.currentDepth + 1, status: 'llm-calling', code: '', output: '', llmPrompt: prompt, contextId: this.contextId, startedAt: Date.now() } as RLMNode });

                const resp = await llmQueryHandler(prompt, nodeId);
                this.eventCallback({ type: 'node:status', nodeId, status: 'completed' });

                currentCode = `_llm_cache = {${JSON.stringify(prompt)}: ${JSON.stringify(resp)}}\n${code}`;
                continue;
            }

            // exit 42/43 means LLM query pending - continue loop
            if (exitCode === 42 || exitCode === 43) continue;

            // real error
            if (exitCode !== 0) {
                this.eventCallback({ type: 'node:error', nodeId: this.parentNodeId, error: output });
                return { success: false, output: fullOutput, error: `Exit code ${exitCode}: ${output}` };
            }

            // done
            return { success: true, output: fullOutput, finalResult: fullOutput.trim() || 'Done' };
        }

        return { success: false, output: fullOutput, error: 'Max iterations' };
    }

    async close(): Promise<void> {
        this.sandbox = null;
    }
}

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
