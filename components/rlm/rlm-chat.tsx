'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PlayIcon, StopCircleIcon, RefreshCwIcon, UploadIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { useRLM } from '@/hooks/use-rlm';
import { RecursionTree } from './recursion-tree';
import { CodePanel } from './code-panel';
import { RLMStatus } from './rlm-status';
import { ExecutionLog } from './execution-log';
import { getNodeById } from '@/lib/rlm/tree-state';

export interface RLMChatProps {
    initialContext?: string;
    initialQuery?: string;
    maxDepth?: number;
    className?: string;
}

export function RLMChat({ initialContext = '', initialQuery = '', maxDepth = 1, className }: RLMChatProps) {
    // query and context state
    const [query, setQuery] = useState(initialQuery);
    const [context, setContext] = useState(initialContext);
    const [finalResult, setFinalResult] = useState<string | null>(null);
    const [logCollapsed, setLogCollapsed] = useState(false);

    // RLM hook
    const { treeState, isRunning, execute, reset, selectedNodeId, setSelectedNodeId, stats } = useRLM({
        onComplete: (result) => {
            setFinalResult(result);
        },
        onError: (error) => {
            console.error('RLM Error:', error);
        },
    });

    // get selected node
    const selectedNode = selectedNodeId ? getNodeById(treeState, selectedNodeId) : null;

    // handle submit
    const handleSubmit = useCallback(() => {
        if (!query.trim() || !context.trim() || isRunning) return;

        setFinalResult(null);
        execute({ query, context, maxDepth });
    }, [query, context, maxDepth, isRunning, execute]);

    // handle reset
    const handleReset = useCallback(() => {
        reset();
        setFinalResult(null);
    }, [reset]);

    // handle file upload for context
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setContext(text);
        };
        reader.readAsText(file);
    }, []);

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* status bar */}
            <RLMStatus treeState={treeState} isRunning={isRunning} />

            {/* main content area */}
            <div className='flex-1 flex overflow-hidden'>
                {/* left: tree visualization + log */}
                <div className='flex-1 min-w-0 flex flex-col'>
                    {/* tree */}
                    <div className='flex-1 p-2'>
                        <RecursionTree treeState={treeState} selectedNodeId={selectedNodeId} onNodeSelect={setSelectedNodeId} />
                    </div>

                    {/* collapsible log */}
                    <div className='border-t border-gray-200'>
                        {/* log header with toggle */}
                        <button
                            onClick={() => setLogCollapsed(!logCollapsed)}
                            className='w-full flex items-center justify-between px-3 py-1.5 bg-gray-100 hover:bg-gray-200 transition-colors'
                        >
                            <span className='text-xs font-medium text-gray-600'>Execution Log</span>
                            {logCollapsed ? (
                                <ChevronUpIcon className='w-4 h-4 text-gray-500' />
                            ) : (
                                <ChevronDownIcon className='w-4 h-4 text-gray-500' />
                            )}
                        </button>

                        {/* log content */}
                        {!logCollapsed && (
                            <div className='h-[150px]'>
                                <ExecutionLog treeState={treeState} className='h-full' />
                            </div>
                        )}
                    </div>
                </div>

                {/* right: code panel (when node selected) */}
                {selectedNode && (
                    <div className='w-[400px] border-l border-gray-200 p-4'>
                        <CodePanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
                    </div>
                )}
            </div>

            {/* final result */}
            {finalResult && (
                <div className='px-4 py-3 bg-green-50 border-t border-green-200 max-h-[200px] overflow-y-auto'>
                    <div className='flex items-start gap-2'>
                        <span className='text-xs font-medium text-green-700 uppercase flex-shrink-0'>Result:</span>
                        <p className='text-sm text-green-800 whitespace-pre-wrap'>{finalResult}</p>
                    </div>
                </div>
            )}

            {/* input area */}
            <div className='border-t border-gray-200 bg-white p-4'>
                <div className='space-y-3'>
                    {/* query input */}
                    <div>
                        <label className='block text-xs font-medium text-gray-600 mb-1'>Query</label>
                        <input
                            type='text'
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder='What do you want to analyze?'
                            className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                            disabled={isRunning}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />
                    </div>

                    {/* context input */}
                    <div>
                        <div className='flex items-center justify-between mb-1'>
                            <label className='text-xs font-medium text-gray-600'>
                                Context <span className='text-gray-400'>({context.length.toLocaleString()} chars)</span>
                            </label>
                            <label className='flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-700'>
                                <UploadIcon className='w-3 h-3' />
                                Upload file
                                <input type='file' className='hidden' accept='.txt,.json,.csv,.md' onChange={handleFileUpload} />
                            </label>
                        </div>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder='Paste your data here or upload a file...'
                            className='w-full h-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                            disabled={isRunning}
                        />
                    </div>

                    {/* action buttons */}
                    <div className='flex items-center gap-2'>
                        {!isRunning ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!query.trim() || !context.trim()}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                                    query.trim() && context.trim()
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                )}
                            >
                                <PlayIcon className='w-4 h-4' />
                                Execute RLM
                            </button>
                        ) : (
                            <button
                                onClick={handleReset}
                                className='flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors'
                            >
                                <StopCircleIcon className='w-4 h-4' />
                                Stop
                            </button>
                        )}

                        {treeState.nodes.length > 0 && !isRunning && (
                            <button
                                onClick={handleReset}
                                className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors'
                            >
                                <RefreshCwIcon className='w-4 h-4' />
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
