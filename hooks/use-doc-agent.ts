import { useState, useCallback } from 'react';
import type { DocEvent, DocNode, DocTreeState, DocGenerateRequest } from '@/lib/doc-agent/types';

export interface UseDocAgentReturn {
    state: DocTreeState;
    isRunning: boolean;
    generate: (request: DocGenerateRequest) => Promise<void>;
    reset: () => void;
}

const initialState: DocTreeState = {
    nodes: [],
    status: 'idle',
};

export function useDocAgent(): UseDocAgentReturn {
    const [state, setState] = useState<DocTreeState>(initialState);
    const [isRunning, setIsRunning] = useState(false);

    // generate docs via SSE
    const generate = useCallback(async (request: DocGenerateRequest) => {
        setIsRunning(true);
        setState({ nodes: [], status: 'scanning' });

        try {
            const response = await fetch('/api/docs/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const event: DocEvent = JSON.parse(line.slice(6));
                        handleEvent(event, setState);
                    } catch {
                        // skip malformed events
                    }
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            setState((prev) => ({ ...prev, status: 'error', error: errorMsg }));
        } finally {
            setIsRunning(false);
        }
    }, []);

    // reset state
    const reset = useCallback(() => {
        setState(initialState);
    }, []);

    return { state, isRunning, generate, reset };
}

// handle SSE events
function handleEvent(
    event: DocEvent,
    setState: React.Dispatch<React.SetStateAction<DocTreeState>>
) {
    switch (event.type) {
        case 'scan:start':
            setState((prev) => ({ ...prev, status: 'scanning' }));
            break;

        case 'scan:complete':
            setState((prev) => ({ ...prev, status: 'documenting' }));
            break;

        case 'node:created':
            setState((prev) => ({
                ...prev,
                nodes: [...prev.nodes, event.node],
            }));
            break;

        case 'node:status':
            setState((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === event.nodeId ? { ...n, status: event.status } : n
                ),
            }));
            break;

        case 'node:documented':
            setState((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === event.nodeId ? { ...n, documentation: event.documentation } : n
                ),
            }));
            break;

        case 'node:error':
            setState((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === event.nodeId ? { ...n, status: 'error', error: event.error } : n
                ),
            }));
            break;

        case 'summary:complete':
            setState((prev) => ({ ...prev, projectSummary: event.summary }));
            break;

        case 'execution:complete':
            setState((prev) => ({ ...prev, status: 'completed' }));
            break;

        case 'execution:error':
            setState((prev) => ({ ...prev, status: 'error', error: event.error }));
            break;
    }
}
