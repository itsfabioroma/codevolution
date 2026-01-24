// RLM execution node status
export type RLMNodeStatus = 'pending' | 'executing' | 'llm-calling' | 'completed' | 'error';

// single node in the recursion tree
export interface RLMNode {
    id: string;
    parentId: string | null;
    depth: number;
    status: RLMNodeStatus;

    // code execution
    code: string;
    output: string;
    error?: string;

    // llm_query details
    llmPrompt?: string;
    llmResponse?: string;

    // ultracontext
    contextId: string;

    // timing
    startedAt: number;
    completedAt?: number;
}

// full tree state for visualization
export interface RLMTreeState {
    nodes: RLMNode[];
    rootContextId: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    finalResult?: string;
    error?: string;
}

// SSE event types for real-time updates
export type RLMEvent =
    | { type: 'node:created'; node: RLMNode }
    | { type: 'node:status'; nodeId: string; status: RLMNodeStatus }
    | { type: 'node:output'; nodeId: string; output: string }
    | { type: 'node:llm-start'; nodeId: string; prompt: string }
    | { type: 'node:llm-end'; nodeId: string; response: string }
    | { type: 'node:error'; nodeId: string; error: string }
    | { type: 'execution:complete'; result: string }
    | { type: 'execution:error'; error: string };

// request body for /api/rlm/execute
export interface RLMExecuteRequest {
    query: string;
    context: string;
    contextId?: string; // existing UC context, or create new
    maxDepth?: number;  // how deep sub-agents can recurse (default 1)
}

// llm_query callback payload (from Python sandbox)
export interface LLMQueryRequest {
    executionId: string;
    nodeId: string;
    prompt: string;
}

// config for RLM execution
export interface RLMConfig {
    maxDepth: number;
    timeoutMs: number;
    model: string;
}

export const DEFAULT_RLM_CONFIG: RLMConfig = {
    maxDepth: 3,
    timeoutMs: 60000,
    model: 'claude-opus-4-5-20251101',
};
