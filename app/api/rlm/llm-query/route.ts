import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { UltraContext } from 'ultracontext';
import { nanoid } from 'nanoid';
import type { LLMQueryRequest } from '@/lib/rlm/types';
import { RLM_SUB_PROMPT } from '@/lib/rlm/rlm-prompt';

// store for pending llm_query requests (executionId -> resolver map)
// in production, use Redis or similar
const pendingQueries = new Map<string, {
    resolve: (response: string) => void;
    reject: (error: Error) => void;
}>();

export async function POST(req: Request) {
    const body: LLMQueryRequest = await req.json();
    const { executionId, nodeId, prompt } = body;

    // init UC client
    const apiKey = process.env.ULTRACONTEXT_API_KEY;
    if (!apiKey) throw new Error('Missing ULTRACONTEXT_API_KEY');
    const uc = new UltraContext({ apiKey });

    try {
        // create a forked context for this sub-LLM call
        const subContextId = `rlm-sub-${nanoid(8)}`;

        // call sub-LLM (using Opus as specified in decisions)
        const result = await generateText({
            model: anthropic('claude-opus-4-5-20251101'),
            system: RLM_SUB_PROMPT,
            prompt: prompt,
            maxOutputTokens: 4096,
        });

        const response = result.text;

        return Response.json({
            success: true,
            response,
            nodeId,
            executionId,
        });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return Response.json(
            {
                success: false,
                error: errorMsg,
                response: `Error: ${errorMsg}`,
            },
            { status: 500 }
        );
    }
}
