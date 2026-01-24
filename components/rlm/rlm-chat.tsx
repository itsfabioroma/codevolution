'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PlayIcon, StopCircleIcon, RefreshCwIcon, UploadIcon, ChevronUpIcon, ChevronDownIcon, LoaderIcon, GithubIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { useRLM } from '@/hooks/use-rlm';
import { RecursionTree } from './recursion-tree';
import { CodePanel } from './code-panel';
import { RLMStatus } from './rlm-status';
import { ExecutionLog } from './execution-log';
import { getNodeById } from '@/lib/rlm/tree-state';

// Check if text looks like a GitHub URL
function isGitHubUrl(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.match(/^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/\s]+/)) {
        return true;
    }
    if (trimmed.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/) && !trimmed.includes(' ')) {
        return true;
    }
    return false;
}

type GitHubStatus = 'idle' | 'loading' | 'success' | 'error';

interface GitHubState {
    status: GitHubStatus;
    message: string;
    repoName?: string;
    fileCount?: number;
}

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

    // GitHub extraction state
    const [githubState, setGithubState] = useState<GitHubState>({ status: 'idle', message: '' });

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

    // handle GitHub URL extraction
    const handleGitHubExtract = useCallback(async (url: string) => {
        setGithubState({ status: 'loading', message: 'Downloading and extracting repository...' });

        try {
            const response = await fetch('/api/github-extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract repository');
            }

            setContext(data.content);
            setGithubState({
                status: 'success',
                message: `Extracted ${data.fileCount} files from ${data.owner}/${data.repo}`,
                repoName: `${data.owner}/${data.repo}`,
                fileCount: data.fileCount,
            });

            // Clear success message after 5 seconds
            setTimeout(() => {
                setGithubState(prev => prev.status === 'success' ? { status: 'idle', message: '' } : prev);
            }, 5000);
        } catch (error) {
            setGithubState({
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to extract repository',
            });

            // Clear error message after 5 seconds
            setTimeout(() => {
                setGithubState(prev => prev.status === 'error' ? { status: 'idle', message: '' } : prev);
            }, 5000);
        }
    }, []);

    // handle context change with GitHub URL detection
    const handleContextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setContext(value);

        // Check if the pasted content is a GitHub URL
        if (isGitHubUrl(value) && githubState.status !== 'loading') {
            handleGitHubExtract(value);
        }
    }, [githubState.status, handleGitHubExtract]);

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

                        {/* GitHub status message */}
                        {githubState.status !== 'idle' && (
                            <div className={cn(
                                'flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-sm',
                                githubState.status === 'loading' && 'bg-blue-50 text-blue-700',
                                githubState.status === 'success' && 'bg-green-50 text-green-700',
                                githubState.status === 'error' && 'bg-red-50 text-red-700'
                            )}>
                                {githubState.status === 'loading' && (
                                    <LoaderIcon className='w-4 h-4 animate-spin' />
                                )}
                                {githubState.status === 'success' && (
                                    <CheckCircleIcon className='w-4 h-4' />
                                )}
                                {githubState.status === 'error' && (
                                    <XCircleIcon className='w-4 h-4' />
                                )}
                                <span>{githubState.message}</span>
                            </div>
                        )}

                        <div className='relative'>
                            <textarea
                                value={context}
                                onChange={handleContextChange}
                                placeholder='Paste your data, GitHub URL (e.g., owner/repo), or upload a file...'
                                className={cn(
                                    'w-full h-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                                    githubState.status === 'loading' && 'opacity-50'
                                )}
                                disabled={isRunning || githubState.status === 'loading'}
                            />
                            {githubState.status === 'loading' && (
                                <div className='absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg'>
                                    <div className='flex items-center gap-2 text-blue-600'>
                                        <GithubIcon className='w-5 h-5' />
                                        <LoaderIcon className='w-4 h-4 animate-spin' />
                                        <span className='text-sm font-medium'>Extracting repository...</span>
                                    </div>
                                </div>
                            )}
                        </div>
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
