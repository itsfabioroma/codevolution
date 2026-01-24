import type { RLMNode, RLMTreeState, RLMEvent, RLMNodeStatus } from './types';

// initial empty state
export function createInitialTreeState(): RLMTreeState {
    return {
        nodes: [],
        rootContextId: '',
        status: 'idle',
    };
}

// reducer for tree state updates
export function treeStateReducer(state: RLMTreeState, event: RLMEvent): RLMTreeState {
    switch (event.type) {
        case 'node:created':
            return {
                ...state,
                status: 'running',
                rootContextId: state.rootContextId || event.node.contextId,
                nodes: [...state.nodes, event.node],
            };

        case 'node:status':
            return {
                ...state,
                nodes: state.nodes.map((node) =>
                    node.id === event.nodeId
                        ? {
                              ...node,
                              status: event.status,
                              completedAt: event.status === 'completed' || event.status === 'error' ? Date.now() : undefined,
                          }
                        : node
                ),
            };

        case 'node:output':
            return {
                ...state,
                nodes: state.nodes.map((node) =>
                    node.id === event.nodeId ? { ...node, output: node.output + event.output + '\n' } : node
                ),
            };

        case 'node:llm-start':
            return {
                ...state,
                nodes: state.nodes.map((node) => (node.id === event.nodeId ? { ...node, llmPrompt: event.prompt } : node)),
            };

        case 'node:llm-end':
            return {
                ...state,
                nodes: state.nodes.map((node) =>
                    node.id === event.nodeId ? { ...node, llmResponse: event.response, code: event.response } : node
                ),
            };

        case 'node:error':
            return {
                ...state,
                nodes: state.nodes.map((node) =>
                    node.id === event.nodeId ? { ...node, error: event.error, status: 'error' as RLMNodeStatus } : node
                ),
            };

        case 'execution:complete':
            return {
                ...state,
                status: 'completed',
                finalResult: event.result,
            };

        case 'execution:error':
            return {
                ...state,
                status: 'error',
                error: event.error,
            };

        default:
            return state;
    }
}

// get node by ID
export function getNodeById(state: RLMTreeState, nodeId: string): RLMNode | undefined {
    return state.nodes.find((n) => n.id === nodeId);
}

// get children of a node
export function getChildNodes(state: RLMTreeState, nodeId: string): RLMNode[] {
    return state.nodes.filter((n) => n.parentId === nodeId);
}

// get root node
export function getRootNode(state: RLMTreeState): RLMNode | undefined {
    return state.nodes.find((n) => n.parentId === null);
}

// calc tree stats
export function getTreeStats(state: RLMTreeState) {
    const totalNodes = state.nodes.length;
    const completedNodes = state.nodes.filter((n) => n.status === 'completed').length;
    const errorNodes = state.nodes.filter((n) => n.status === 'error').length;
    const runningNodes = state.nodes.filter((n) => n.status === 'executing' || n.status === 'llm-calling').length;
    const maxDepth = Math.max(0, ...state.nodes.map((n) => n.depth));

    // calc total duration
    const rootNode = getRootNode(state);
    const duration = rootNode ? (rootNode.completedAt || Date.now()) - rootNode.startedAt : 0;

    return {
        totalNodes,
        completedNodes,
        errorNodes,
        runningNodes,
        maxDepth,
        duration,
    };
}
