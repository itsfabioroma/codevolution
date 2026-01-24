'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { CodeIcon, CheckCircleIcon, XCircleIcon, LoaderIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { UCLogo } from './uc-logo';
import type { RLMNode, RLMNodeStatus } from '@/lib/rlm/types';

// node data type for React Flow (with index signature for compatibility)
export interface ExecutionNodeData {
    rlmNode: RLMNode;
    isSelected?: boolean;
    hasChildren?: boolean;
    isExpanded?: boolean;
    childCount?: number;
    onClick?: () => void;
    onExpand?: () => void;
    [key: string]: unknown;
}

// status config
const STATUS_CONFIG: Record<
    RLMNodeStatus,
    {
        icon: typeof LoaderIcon | null; // null = use UCLogo
        color: string;
        bgColor: string;
        borderColor: string;
        label: string;
        animate?: boolean;
    }
> = {
    pending: {
        icon: LoaderIcon,
        color: 'text-gray-400',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200 border-dashed',
        label: 'Pending',
    },
    executing: {
        icon: CodeIcon,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        label: 'Executing',
        animate: true,
    },
    'llm-calling': {
        icon: null, // use UCLogo
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-300',
        label: 'Calling LLM',
        animate: true,
    },
    completed: {
        icon: CheckCircleIcon,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        label: 'Completed',
    },
    error: {
        icon: XCircleIcon,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        label: 'Error',
    },
};

// format duration
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

// props type
interface ExecutionNodeProps {
    data: ExecutionNodeData;
}

// render icon based on config (null = UCLogo)
function StatusIcon({ config, className }: { config: typeof STATUS_CONFIG[RLMNodeStatus]; className?: string }) {
    if (config.icon === null) {
        return <UCLogo className={className} animate={config.animate} />;
    }
    const Icon = config.icon;
    return <Icon className={className} />;
}

// custom execution node component
export const ExecutionNode = memo(({ data }: ExecutionNodeProps) => {
    const { rlmNode, isSelected, hasChildren, isExpanded, childCount, onClick, onExpand } = data;
    const config = STATUS_CONFIG[rlmNode.status];

    // calc duration
    const duration = rlmNode.completedAt ? rlmNode.completedAt - rlmNode.startedAt : Date.now() - rlmNode.startedAt;

    // preview content (code for root, prompt for children)
    const previewContent = rlmNode.parentId ? rlmNode.llmPrompt : rlmNode.code;
    const codePreview = previewContent
        ? previewContent
              .split('\n')
              .slice(0, 3)
              .map((line: string) => line.slice(0, 40))
              .join('\n')
        : '';

    const isChild = !!rlmNode.parentId;

    // COMPACT CIRCLE for child nodes
    if (isChild) {
        return (
            <div className='relative'>
                <div
                    className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all',
                        'border-2 shadow-sm',
                        config.bgColor,
                        config.borderColor,
                        isSelected && 'ring-2 ring-offset-1 ring-blue-500 scale-125',
                        config.animate && 'animate-pulse'
                    )}
                    onClick={onClick}
                    title={`#${rlmNode.id.slice(0, 4)} - ${config.label}${rlmNode.llmPrompt ? '\n' + rlmNode.llmPrompt.slice(0, 100) : ''}`}
                >
                    <Handle type='target' position={Position.Top} className='!bg-transparent !border-0 !w-1 !h-1' />
                    <StatusIcon config={config} className={cn('w-3.5 h-3.5', config.color)} />
                    <Handle type='source' position={Position.Bottom} className='!bg-transparent !border-0 !w-1 !h-1' />
                </div>

                {/* expand/collapse badge for nodes with children */}
                {hasChildren && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onExpand?.();
                        }}
                        className={cn(
                            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center',
                            'bg-white border border-gray-300 shadow-sm hover:bg-gray-100 transition-colors',
                            'text-[8px] font-bold text-gray-600'
                        )}
                        title={isExpanded ? `Collapse ${childCount} children` : `Expand ${childCount} children`}
                    >
                        {isExpanded ? (
                            <ChevronDownIcon className='w-2.5 h-2.5' />
                        ) : (
                            <span>{childCount}</span>
                        )}
                    </button>
                )}
            </div>
        );
    }

    // FULL CARD for root node
    return (
        <div
            className={cn(
                'rounded-lg border-2 shadow-md transition-all duration-200 cursor-pointer',
                'min-w-[200px] max-w-[240px]',
                config.bgColor,
                config.borderColor,
                isSelected && 'ring-2 ring-offset-2 ring-blue-500',
                config.animate && 'animate-pulse'
            )}
            onClick={onClick}
        >
            {/* header */}
            <div className={cn('flex items-center justify-between px-3 py-2 border-b', config.borderColor)}>
                <div className='flex items-center gap-2'>
                    <StatusIcon config={config} className={cn('w-4 h-4', config.color)} />
                    <span className='text-xs font-medium text-gray-700'>Root #{rlmNode.id.slice(0, 4)}</span>
                </div>
                <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500'>{formatDuration(duration)}</span>

                    {/* expand/collapse for root */}
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onExpand?.();
                            }}
                            className='flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700'
                            title={isExpanded ? 'Collapse children' : 'Expand children'}
                        >
                            {isExpanded ? (
                                <ChevronDownIcon className='w-3 h-3' />
                            ) : (
                                <ChevronRightIcon className='w-3 h-3' />
                            )}
                            <span className='text-[10px]'>{childCount}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* status */}
            <div className='px-3 py-1.5 border-b border-gray-100'>
                <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
            </div>

            {/* code preview */}
            {codePreview && (
                <div className='px-3 py-2'>
                    <pre className='text-[10px] font-mono text-gray-600 overflow-hidden whitespace-pre-wrap line-clamp-3'>
                        {codePreview.slice(0, 120)}...
                    </pre>
                </div>
            )}

            {/* error */}
            {rlmNode.error && (
                <div className='px-3 py-1 bg-red-100 text-red-600 text-[10px] truncate'>{rlmNode.error.slice(0, 50)}...</div>
            )}

            {/* handle for outgoing edges */}
            <Handle type='source' position={Position.Bottom} className='!bg-gray-400 !w-3 !h-3' />
        </div>
    );
});

ExecutionNode.displayName = 'ExecutionNode';
