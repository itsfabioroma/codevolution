'use client';

import { useState } from 'react';
import { RLMChat } from '@/components/rlm/rlm-chat';
import { generateOolongPairs } from '@/lib/rlm/oolong-generator';
import { generateContradictionDataset } from '@/lib/rlm/contradiction-generator';
import { UCLogo } from '@/components/rlm/uc-logo';

// demo types
type DemoExample = {
    name: string;
    description: string;
    query: string;
    contextGenerator: () => string;
    expectedAnswer?: string;
};

// demo presets
const DEMO_EXAMPLES: DemoExample[] = [
    // Contradiction Finder
    {
        name: 'Contradiction Finder (500)',
        description: '500 statements, ~125K pair comparisons',
        query: 'Find all contradicting statement pairs. Use llm_query_batch() for maximum parallelism.',
        contextGenerator: () => generateContradictionDataset(500, 0.1).statements,
        expectedAnswer: '~50 contradictions',
    },

    // OOLONG benchmarks
    {
        name: 'OOLONG-Pairs (1K)',
        description: 'Count pairs with diff=10',
        query: 'Count how many pairs have values that differ by exactly 10.',
        contextGenerator: () => generateOolongPairs(1000),
    },
    {
        name: 'OOLONG-Pairs (10K)',
        description: 'Larger scale counting',
        query: 'Count pairs where abs(value_a - value_b) == 10. Use batch processing.',
        contextGenerator: () => generateOolongPairs(10000),
    },
    {
        name: 'OOLONG + Prime Check',
        description: 'Count pairs where diff=10 AND both values are prime',
        query: 'Find pairs where abs(value_a - value_b) == 10 AND both are prime. Use llm_query_batch().',
        contextGenerator: () => generateOolongPairs(500),
    },
];

export default function RLMPage() {
    const [selectedExample, setSelectedExample] = useState<DemoExample | null>(null);
    const [generatedContext, setGeneratedContext] = useState('');
    const [generatedQuery, setGeneratedQuery] = useState('');
    const [maxDepth, setMaxDepth] = useState(1);

    const handleExampleSelect = (example: DemoExample) => {
        setSelectedExample(example);
        setGeneratedContext(example.contextGenerator());
        setGeneratedQuery(example.query);
    };

    return (
        <div className='min-h-screen bg-gray-50'>
            {/* header */}
            <header className='bg-white border-b border-gray-200'>
                <div className='max-w-7xl mx-auto px-4 py-3'>
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <div className='p-1.5 bg-black rounded'>
                                <UCLogo className='w-5 h-5 text-white' />
                            </div>
                            <div>
                                <h1 className='text-lg font-semibold text-gray-900'>10M Token Global Reasoning</h1>
                                <p className='text-xs text-gray-500'>The Recursive Reasoning Engine</p>
                            </div>
                        </div>

                        {/* depth control */}
                        <div className='flex items-center gap-2 text-sm'>
                            <span className='text-gray-500'>Depth:</span>
                            <input
                                type='range'
                                min='1'
                                max='4'
                                value={maxDepth}
                                onChange={(e) => setMaxDepth(Number(e.target.value))}
                                className='w-16 accent-gray-800'
                            />
                            <span className='font-mono text-gray-800'>{maxDepth}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* demo examples */}
            <div className='max-w-7xl mx-auto px-4 py-2'>
                <div className='flex items-center gap-2 mb-2'>
                    <span className='text-sm font-medium text-gray-600'>Select Demo:</span>
                </div>
                <div className='flex items-center gap-3 overflow-x-auto pb-2'>
                    {DEMO_EXAMPLES.map((example) => (
                        <button
                            key={example.name}
                            onClick={() => handleExampleSelect(example)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-colors ${
                                selectedExample?.name === example.name
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <div className='text-sm font-medium'>{example.name}</div>
                            <div className='text-xs text-gray-500'>{example.description}</div>
                            {example.expectedAnswer && (
                                <div className='text-[10px] text-green-600 mt-1'>Expected: {example.expectedAnswer}</div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* main content */}
            <div className='max-w-7xl mx-auto px-4 pb-4'>
                <div
                    className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'
                    style={{ height: 'calc(100vh - 280px)' }}
                >
                    <RLMChat
                        initialContext={generatedContext}
                        initialQuery={generatedQuery}
                        maxDepth={maxDepth}
                        key={`${selectedExample?.name}-${maxDepth}`}
                    />
                </div>
            </div>
        </div>
    );
}
