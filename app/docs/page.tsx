'use client';

import { useState } from 'react';
import { useDocAgent } from '@/hooks/use-doc-agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DocsPage() {
    const { state, isRunning, generate, reset } = useDocAgent();
    const [rootPath, setRootPath] = useState('');
    const [patterns, setPatterns] = useState('\\.tsx?$, \\.ts$');

    // trigger generation
    const handleGenerate = () => {
        if (!rootPath) return;
        generate({
            rootPath,
            patterns: patterns.split(',').map((p) => p.trim()),
        });
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">Doc Agent</h1>

            {/* input form */}
            <div className="border rounded-lg p-4 mb-6 space-y-4">
                <h2 className="font-semibold">Generate Documentation</h2>
                <div>
                    <label className="text-sm font-medium block mb-1">Root Path</label>
                    <Input
                        value={rootPath}
                        onChange={(e) => setRootPath(e.target.value)}
                        placeholder="/path/to/codebase"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium block mb-1">Patterns (regex, comma-separated)</label>
                    <Input
                        value={patterns}
                        onChange={(e) => setPatterns(e.target.value)}
                        placeholder="\.tsx?$, \.py$"
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleGenerate} disabled={isRunning || !rootPath}>
                        {isRunning ? 'Generating...' : 'Generate'}
                    </Button>
                    <Button variant="outline" onClick={reset}>
                        Reset
                    </Button>
                </div>
            </div>

            {/* status */}
            <div className="mb-4 flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <span
                    className={`px-2 py-0.5 text-xs rounded ${
                        state.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : state.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {state.status}
                </span>
                {state.nodes.length > 0 && (
                    <span className="text-sm text-gray-500">
                        {state.nodes.filter((n) => n.status === 'completed').length}/{state.nodes.length} files
                    </span>
                )}
            </div>

            {/* file nodes */}
            {state.nodes.length > 0 && (
                <div className="border rounded-lg p-4 mb-6">
                    <h2 className="font-semibold mb-2">Files</h2>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {state.nodes.map((node) => (
                            <div
                                key={node.id}
                                className="flex items-center justify-between p-2 border rounded"
                            >
                                <span className="text-sm font-mono truncate flex-1">
                                    {node.filePath}
                                </span>
                                <span
                                    className={`px-2 py-0.5 text-xs rounded ${
                                        node.status === 'completed'
                                            ? 'bg-green-100 text-green-800'
                                            : node.status === 'error'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}
                                >
                                    {node.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* project summary */}
            {state.projectSummary && (
                <div className="border rounded-lg p-4 mb-6">
                    <h2 className="font-semibold mb-2">Project Summary</h2>
                    <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded overflow-auto max-h-96">
                        {state.projectSummary}
                    </pre>
                </div>
            )}

            {/* error */}
            {state.error && (
                <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                    <p className="text-red-600">{state.error}</p>
                </div>
            )}
        </div>
    );
}
