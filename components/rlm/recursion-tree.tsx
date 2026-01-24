'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MaximizeIcon, MinimizeIcon } from 'lucide-react';

import { ExecutionNode, type ExecutionNodeData } from './execution-node';
import type { RLMTreeState, RLMNode } from '@/lib/rlm/types';

// node types
const nodeTypes = {
    execution: ExecutionNode,
};

// layout config
const CHILD_NODE_SIZE = 32; // circle diameter

// radial/circular layout around parent - supports nested levels
function getRadialLayout(nodes: Node[], edges: Edge[]) {
    if (nodes.length === 0) return { nodes, edges };

    // build parent positions map (computed incrementally)
    const positions: Record<string, { x: number; y: number }> = {};

    // group children by parent
    const childrenByParent: Record<string, Node[]> = {};
    let rootId: string | null = null;

    nodes.forEach((node) => {
        const data = node.data as ExecutionNodeData;
        const parentId = data?.rlmNode?.parentId;
        if (!parentId) {
            rootId = node.id;
        } else {
            if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
            childrenByParent[parentId].push(node);
        }
    });

    if (!rootId) return { nodes, edges };

    // position root at center
    positions[rootId] = { x: 0, y: 0 };

    // BFS to position all nodes level by level
    const queue: string[] = [rootId];
    while (queue.length > 0) {
        const parentId = queue.shift()!;
        const parentPos = positions[parentId];
        const children = childrenByParent[parentId] || [];

        if (children.length === 0) continue;

        // get parent's depth to determine radius
        const parentNode = nodes.find((n) => n.id === parentId);
        const parentDepth = (parentNode?.data as ExecutionNodeData)?.rlmNode?.depth || 0;

        // radius grows with depth and child count
        const baseRadius = 120 + parentDepth * 80;
        const radius = baseRadius + Math.sqrt(children.length) * 10;

        children.forEach((child, idx) => {
            const total = children.length;
            const angle = (idx / total) * Math.PI * 2 - Math.PI / 2; // start at top

            positions[child.id] = {
                x: parentPos.x + Math.cos(angle) * radius,
                y: parentPos.y + Math.sin(angle) * radius,
            };

            queue.push(child.id);
        });
    }

    // apply positions
    const layoutedNodes = nodes.map((node) => {
        const pos = positions[node.id] || { x: 0, y: 0 };
        const data = node.data as ExecutionNodeData;
        const isRoot = !data?.rlmNode?.parentId;

        return {
            ...node,
            position: {
                x: pos.x - (isRoot ? 100 : CHILD_NODE_SIZE / 2),
                y: pos.y - (isRoot ? 45 : CHILD_NODE_SIZE / 2),
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

// check if a node's parent chain is all expanded (visible)
function isNodeVisible(
    node: RLMNode,
    allNodes: RLMNode[],
    expandedNodes: Set<string>
): boolean {
    // root is always visible
    if (!node.parentId) return true;

    // depth 1 nodes are always visible (children of root)
    if (node.depth === 1) return true;

    // for deeper nodes, check if parent is expanded
    const parent = allNodes.find((n) => n.id === node.parentId);
    if (!parent) return false;

    // parent must be expanded AND visible itself
    return expandedNodes.has(parent.id) && isNodeVisible(parent, allNodes, expandedNodes);
}

// convert RLM tree state to React Flow elements
function convertToFlowElements(
    treeState: RLMTreeState,
    selectedNodeId: string | null,
    expandedNodes: Set<string>,
    onNodeClick: (nodeId: string) => void,
    onNodeExpand: (nodeId: string) => void
): { nodes: Node[]; edges: Edge[] } {
    // build children map
    const childrenByParent: Record<string, RLMNode[]> = {};
    treeState.nodes.forEach((node) => {
        if (node.parentId) {
            if (!childrenByParent[node.parentId]) childrenByParent[node.parentId] = [];
            childrenByParent[node.parentId].push(node);
        }
    });

    // filter to visible nodes only
    const visibleNodes = treeState.nodes.filter((node) =>
        isNodeVisible(node, treeState.nodes, expandedNodes)
    );

    const nodes: Node[] = visibleNodes.map((rlmNode) => {
        const children = childrenByParent[rlmNode.id] || [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.has(rlmNode.id);

        return {
            id: rlmNode.id,
            type: 'execution',
            position: { x: 0, y: 0 }, // will be set by layout
            data: {
                rlmNode,
                isSelected: rlmNode.id === selectedNodeId,
                hasChildren,
                isExpanded,
                childCount: children.length,
                onClick: () => onNodeClick(rlmNode.id),
                onExpand: () => onNodeExpand(rlmNode.id),
            } as ExecutionNodeData,
        };
    });

    // edges only between visible nodes
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const edges: Edge[] = visibleNodes
        .filter((node) => node.parentId && visibleIds.has(node.parentId))
        .map((node) => ({
            id: `${node.parentId}-${node.id}`,
            source: node.parentId!,
            target: node.id,
            type: 'straight',
            animated: node.status === 'executing' || node.status === 'llm-calling',
            style: {
                stroke: node.status === 'pending' ? '#e5e7eb' : '#9ca3af',
                strokeWidth: 1,
            },
        }));

    return getRadialLayout(nodes, edges);
}

export interface RecursionTreeProps {
    treeState: RLMTreeState;
    selectedNodeId: string | null;
    onNodeSelect: (nodeId: string | null) => void;
}

export function RecursionTree({ treeState, selectedNodeId, onNodeSelect }: RecursionTreeProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // track which nodes are expanded (show their children)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const prevRootIdRef = useRef<string | null>(null);

    // auto-expand root node when new execution starts
    useEffect(() => {
        const rootNode = treeState.nodes.find((n) => !n.parentId);
        if (!rootNode) return;

        // new execution started - reset and expand root
        if (rootNode.id !== prevRootIdRef.current) {
            prevRootIdRef.current = rootNode.id;
            setExpandedNodes(new Set([rootNode.id]));
        }
    }, [treeState.nodes]);

    // handle fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // handle node click (select for details panel)
    const handleNodeClick = useCallback(
        (nodeId: string) => {
            onNodeSelect(selectedNodeId === nodeId ? null : nodeId);
        },
        [selectedNodeId, onNodeSelect]
    );

    // handle node expand/collapse
    const handleNodeExpand = useCallback((nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // update nodes/edges when tree state or expanded state changes
    useEffect(() => {
        if (treeState.nodes.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const { nodes: layoutedNodes, edges: layoutedEdges } = convertToFlowElements(
            treeState,
            selectedNodeId,
            expandedNodes,
            handleNodeClick,
            handleNodeExpand
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [treeState, selectedNodeId, expandedNodes, handleNodeClick, handleNodeExpand, setNodes, setEdges]);

    // empty state
    if (treeState.nodes.length === 0) {
        return (
            <div className='w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200'>
                <div className='text-center text-gray-400'>
                    <p className='text-sm font-medium'>No execution tree</p>
                    <p className='text-xs mt-1'>Submit a query to start</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className='w-full h-full bg-white'>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={2}
                attributionPosition='bottom-left'
            >
                <Background color='#e5e7eb' gap={16} />

                {/* zoom controls + fullscreen */}
                <Controls showInteractive={false}>
                    <button
                        onClick={toggleFullscreen}
                        className='react-flow__controls-button'
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? (
                            <MinimizeIcon className='w-3 h-3' />
                        ) : (
                            <MaximizeIcon className='w-3 h-3' />
                        )}
                    </button>
                </Controls>

                <MiniMap
                    nodeColor={(node) => {
                        const data = node.data as ExecutionNodeData;
                        const status = data?.rlmNode?.status;
                        switch (status) {
                            case 'completed':
                                return '#22c55e';
                            case 'error':
                                return '#ef4444';
                            case 'executing':
                            case 'llm-calling':
                                return '#3b82f6';
                            default:
                                return '#9ca3af';
                        }
                    }}
                    maskColor='rgba(0, 0, 0, 0.1)'
                />
            </ReactFlow>
        </div>
    );
}
