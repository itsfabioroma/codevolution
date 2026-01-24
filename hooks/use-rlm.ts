'use client';

import { useCallback, useReducer, useRef, useState } from 'react';
import type { RLMEvent, RLMTreeState, RLMExecuteRequest } from '@/lib/rlm/types';
import { createInitialTreeState, treeStateReducer, getTreeStats } from '@/lib/rlm/tree-state';

export interface UseRLMOptions {
    onComplete?: (result: string) => void;
    onError?: (error: string) => void;
}

export interface UseRLMReturn {
    treeState: RLMTreeState;
    stats: ReturnType<typeof getTreeStats>;
    isRunning: boolean;
    execute: (request: RLMExecuteRequest) => Promise<void>;
    reset: () => void;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
}

export function useRLM(options: UseRLMOptions = {}): UseRLMReturn {
    const { onComplete, onError } = options;

    const [treeState, dispatch] = useReducer(treeStateReducer, null, createInitialTreeState);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // execute RLM query
    const execute = useCallback(
        async (request: RLMExecuteRequest) => {
            // cancel any existing execution
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // reset state
            dispatch({ type: 'execution:error', error: '' }); // hack to reset
            setIsRunning(true);

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const response = await fetch('/api/rlm/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(request),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                if (!response.body) {
                    throw new Error('No response body');
                }

                // read SSE stream
                const reader = response.body.getReader();
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
                        if (line.startsWith('data: ')) {
                            try {
                                const event: RLMEvent = JSON.parse(line.slice(6));
                                dispatch(event);

                                // handle completion events
                                if (event.type === 'execution:complete') {
                                    onComplete?.(event.result);
                                } else if (event.type === 'execution:error' && event.error) {
                                    onError?.(event.error);
                                }
                            } catch {
                                // ignore parse errors
                            }
                        }
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return; // cancelled, don't report error
                }
                const errorMsg = error instanceof Error ? error.message : String(error);
                dispatch({ type: 'execution:error', error: errorMsg });
                onError?.(errorMsg);
            } finally {
                setIsRunning(false);
                abortControllerRef.current = null;
            }
        },
        [onComplete, onError]
    );

    // reset state
    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        dispatch({ type: 'execution:error', error: '' }); // hack to reset
        setIsRunning(false);
        setSelectedNodeId(null);
    }, []);

    const stats = getTreeStats(treeState);

    return {
        treeState,
        stats,
        isRunning,
        execute,
        reset,
        selectedNodeId,
        setSelectedNodeId,
    };
}
