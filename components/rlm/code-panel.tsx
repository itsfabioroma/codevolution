'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { CodeIcon, TerminalIcon, BrainIcon, XIcon } from 'lucide-react';
import { Streamdown } from 'streamdown';
import type { RLMNode } from '@/lib/rlm/types';

export interface CodePanelProps {
    node: RLMNode | null;
    onClose: () => void;
}

// tab component
function Tab({
    active,
    onClick,
    icon: Icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: typeof CodeIcon;
    label: string;
}) {
    return (
        <button
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
            onClick={onClick}
        >
            <Icon className='w-3.5 h-3.5' />
            {label}
        </button>
    );
}

export const CodePanel = memo(({ node, onClose }: CodePanelProps) => {
    // tabs state (could use useState for tab switching)
    // for now, show all in columns

    if (!node) {
        return (
            <div className='w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200'>
                <div className='text-center text-gray-400'>
                    <CodeIcon className='w-8 h-8 mx-auto mb-2 opacity-50' />
                    <p className='text-sm'>Select a node to view details</p>
                </div>
            </div>
        );
    }

    return (
        <div className='w-full h-full flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden'>
            {/* header */}
            <div className='flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200'>
                <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium text-gray-700'>Node #{node.id.slice(0, 6)}</span>
                    <span
                        className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            node.status === 'completed' && 'bg-green-100 text-green-700',
                            node.status === 'error' && 'bg-red-100 text-red-700',
                            node.status === 'executing' && 'bg-blue-100 text-blue-700',
                            node.status === 'llm-calling' && 'bg-purple-100 text-purple-700',
                            node.status === 'pending' && 'bg-gray-100 text-gray-700'
                        )}
                    >
                        {node.status}
                    </span>
                </div>
                <button onClick={onClose} className='p-1 text-gray-400 hover:text-gray-600 rounded'>
                    <XIcon className='w-4 h-4' />
                </button>
            </div>

            {/* content */}
            <div className='flex-1 overflow-auto p-4 space-y-4'>
                {/* code section */}
                {node.code && (
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <CodeIcon className='w-4 h-4 text-blue-500' />
                            <span className='text-xs font-medium text-gray-600 uppercase'>Generated Code</span>
                        </div>
                        <pre className='p-3 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap'>
                            {node.code}
                        </pre>
                    </div>
                )}

                {/* output section */}
                {node.output && (
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <TerminalIcon className='w-4 h-4 text-green-500' />
                            <span className='text-xs font-medium text-gray-600 uppercase'>Output</span>
                        </div>
                        <pre className='p-3 bg-gray-100 text-gray-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto'>
                            {node.output}
                        </pre>
                    </div>
                )}

                {/* LLM prompt/response section */}
                {node.llmPrompt && (
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <BrainIcon className='w-4 h-4 text-purple-500' />
                            <span className='text-xs font-medium text-gray-600 uppercase'>LLM Prompt</span>
                        </div>
                        <div className='p-3 bg-purple-50 text-gray-800 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-[250px] overflow-y-auto'>
                            {node.llmPrompt}
                        </div>
                    </div>
                )}

                {node.llmResponse && (
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <BrainIcon className='w-4 h-4 text-purple-500' />
                            <span className='text-xs font-medium text-gray-600 uppercase'>LLM Response</span>
                        </div>
                        <div className='p-3 bg-purple-50 text-gray-800 rounded-lg text-sm overflow-x-auto max-h-[250px] overflow-y-auto'>
                            <Streamdown>{node.llmResponse}</Streamdown>
                        </div>
                    </div>
                )}

                {/* error section */}
                {node.error && (
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <XIcon className='w-4 h-4 text-red-500' />
                            <span className='text-xs font-medium text-gray-600 uppercase'>Error</span>
                        </div>
                        <pre className='p-3 bg-red-50 text-red-700 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap'>
                            {node.error}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
});

CodePanel.displayName = 'CodePanel';
