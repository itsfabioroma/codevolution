'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ActivityIcon, CheckCircleIcon, XCircleIcon, ClockIcon, LayersIcon } from 'lucide-react';
import { UCLogo } from './uc-logo';
import type { RLMTreeState } from '@/lib/rlm/types';
import { getTreeStats } from '@/lib/rlm/tree-state';

export interface RLMStatusProps {
    treeState: RLMTreeState;
    isRunning: boolean;
}

// format duration
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
}

export const RLMStatus = memo(({ treeState, isRunning }: RLMStatusProps) => {
    const stats = getTreeStats(treeState);

    // progress percentage
    const progress = stats.totalNodes > 0 ? Math.round((stats.completedNodes / stats.totalNodes) * 100) : 0;

    return (
        <div className='flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200'>
            {/* logo + status */}
            <div className='flex items-center gap-4'>
                {/* UltraContext logo */}
                <div className='flex items-center gap-1.5'>
                    <UCLogo className='w-5 h-5 text-purple-600' />
                    <span className='text-sm font-semibold text-gray-700'>UltraContext</span>
                    <span className='text-xs text-gray-400'>RLM</span>
                </div>

                {/* divider */}
                <div className='w-px h-4 bg-gray-300' />

                {/* running indicator */}
                <div className='flex items-center gap-1.5'>
                    {isRunning ? (
                        <>
                            <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' />
                            <span className='text-xs font-medium text-blue-600'>Running</span>
                        </>
                    ) : treeState.status === 'completed' ? (
                        <>
                            <CheckCircleIcon className='w-4 h-4 text-green-500' />
                            <span className='text-xs font-medium text-green-600'>Completed</span>
                        </>
                    ) : treeState.status === 'error' ? (
                        <>
                            <XCircleIcon className='w-4 h-4 text-red-500' />
                            <span className='text-xs font-medium text-red-600'>Error</span>
                        </>
                    ) : (
                        <>
                            <div className='w-2 h-2 bg-gray-400 rounded-full' />
                            <span className='text-xs font-medium text-gray-500'>Idle</span>
                        </>
                    )}
                </div>

                {/* progress bar (only when running) */}
                {isRunning && stats.totalNodes > 0 && (
                    <div className='flex items-center gap-2'>
                        <div className='w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden'>
                            <div
                                className='h-full bg-blue-500 rounded-full transition-all duration-300'
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className='text-xs text-gray-500'>{progress}%</span>
                    </div>
                )}
            </div>

            {/* stats */}
            <div className='flex items-center gap-4'>
                {/* nodes count */}
                <div className='flex items-center gap-1.5'>
                    <LayersIcon className='w-3.5 h-3.5 text-gray-400' />
                    <span className='text-xs text-gray-600'>
                        {stats.completedNodes}/{stats.totalNodes} nodes
                    </span>
                </div>

                {/* max depth */}
                {stats.maxDepth > 0 && (
                    <div className='flex items-center gap-1.5'>
                        <ActivityIcon className='w-3.5 h-3.5 text-gray-400' />
                        <span className='text-xs text-gray-600'>depth {stats.maxDepth}</span>
                    </div>
                )}

                {/* duration */}
                <div className='flex items-center gap-1.5'>
                    <ClockIcon className='w-3.5 h-3.5 text-gray-400' />
                    <span className='text-xs text-gray-600'>{formatDuration(stats.duration)}</span>
                </div>

                {/* errors */}
                {stats.errorNodes > 0 && (
                    <div className='flex items-center gap-1.5'>
                        <XCircleIcon className='w-3.5 h-3.5 text-red-400' />
                        <span className='text-xs text-red-600'>{stats.errorNodes} errors</span>
                    </div>
                )}
            </div>
        </div>
    );
});

RLMStatus.displayName = 'RLMStatus';
