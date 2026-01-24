import type { UIMessage } from 'ai';
import type { TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { nanoid } from 'nanoid';
import type { NodeResponse } from '@/types/chat';

// Content block type matching Anthropic's API format
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlockParam;

/**
 * Prepares UIMessages for the Anthropic API by:
 * 1. Stripping reasoning parts (reasoning is ephemeral, not meant to be resent)
 * 2. Filtering out messages with empty content
 * 3. Merging consecutive same-role messages (required by Anthropic)
 */
export function prepareMessagesForAnthropic(messages: UIMessage[]): UIMessage[] {
    // Strip reasoning and filter empty messages
    const filtered = messages
        .map((msg) => ({
            ...msg,
            // Remove reasoning parts - they're ephemeral, not meant to be resent to model
            parts: msg.parts.filter((part) => part.type !== 'reasoning'),
        }))
        .filter((msg, idx, arr) => {
            // Always keep the last message if it's from user
            if (idx === arr.length - 1 && msg.role === 'user') return true;

            // Filter out messages with no parts
            if (!msg.parts || msg.parts.length === 0) return false;

            // Check for any content (text or tool parts)
            const hasContent = msg.parts.some((part) => {
                if (part.type === 'text') return part.text?.trim();
                // Tool parts are valid content (they have type like 'tool-weather')
                return true;
            });

            return hasContent;
        });

    // Merge consecutive same-role messages (required by Anthropic API)
    const merged = filtered.reduce((acc, msg) => {
        const last = acc[acc.length - 1];
        if (last && last.role === msg.role) {
            // Merge parts into previous message
            last.parts = [...last.parts, ...msg.parts];
        } else {
            acc.push({ ...msg, parts: [...msg.parts] });
        }
        return acc;
    }, [] as UIMessage[]);

    return merged;
}

/**
 * Converts a UIMessage to UltraContext format (Anthropic content blocks)
 */
export function formatMessageForUC(msg: UIMessage) {
    const content: ContentBlock[] = [];

    for (const part of msg.parts) {
        if (part.type === 'text') {
            content.push({ type: 'text', text: part.text, citations: null });
        } else if (part.type === 'reasoning') {
            content.push({ type: 'thinking', thinking: part.text, signature: '' });
        } else if (part.type.startsWith('tool-')) {
            // Tool parts in UIMessage have type `tool-${toolName}` and contain toolCallId, state, input, output
            const toolPart = part as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown };
            if (toolPart.state === 'output-available' && toolPart.output !== undefined) {
                content.push({
                    type: 'tool_result',
                    tool_use_id: toolPart.toolCallId,
                    content: String(toolPart.output),
                });
            } else if (toolPart.input !== undefined) {
                content.push({
                    type: 'tool_use',
                    id: toolPart.toolCallId,
                    name: part.type.replace('tool-', ''),
                    input: toolPart.input,
                });
            }
        }
    }

    return {
        uuid: msg.id || nanoid(),
        sender: msg.role === 'user' ? 'human' : 'assistant',
        created_at: new Date().toISOString(),
        content,
    };
}

// ------------------------------------------------------------------
// Types reflecting the RAW UltraContext JSON structure
// ------------------------------------------------------------------
interface RawContentItem {
    type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
    text?: string;
    thinking?: string;
    name?: string; // for tool_use
    id?: string; // for tool_use
    input?: unknown; // for tool_use
    tool_use_id?: string; // for tool_result
    content?: unknown; // for tool_result
}

interface RawMessage {
    uuid: string;
    sender: 'human' | 'assistant' | 'unknown';
    created_at: string;
    content: RawContentItem[];
    text?: string;
}

// ------------------------------------------------------------------
// The Adapter Function
// Converts UltraContext API nodes to UIMessage format
// Node structure: { id, type, content: { uuid, sender, content: [...] }, created_at }
// ------------------------------------------------------------------
export function convertToUIMessages(data: NodeResponse[]): UIMessage[] {
    if (!data || !Array.isArray(data)) {
        console.error('Invalid data format: data missing');
        return [];
    }

    return data.map((node, idx) => {
        const parts: UIMessage['parts'] = [];

        // node.content is the original message object
        const msg = node.content as RawMessage | undefined;
        const contentItems = msg?.content;

        // handle content polymorphism
        if (contentItems && Array.isArray(contentItems)) {
            contentItems.forEach((item: RawContentItem) => {
                switch (item.type) {
                    case 'thinking':
                        if (item.thinking) {
                            parts.push({ type: 'reasoning', text: item.thinking });
                        }
                        break;

                    case 'text':
                        if (item.text) {
                            parts.push({ type: 'text', text: item.text });
                        }
                        break;

                    case 'tool_use':
                        // Tool parts in UIMessage need the format tool-${toolName}
                        // e.g., 'tool-weather' for a weather tool
                        if (!item.id || !item.name || item.input === undefined) break;

                        parts.push({
                            type: `tool-${item.name}`,
                            toolCallId: item.id,
                            state: 'input-available',
                            input: item.input,
                        } as UIMessage['parts'][number]);
                        break;

                    case 'tool_result':
                        // Tool results need to match the tool name from the original call
                        // Since UC doesn't store the tool name in tool_result, we skip for now
                        // In a real implementation, you'd need to track tool calls to match results
                        break;
                }
            });
        }

        // ensure at least one text part for user messages
        if (parts.length === 0 && node.type === 'user') {
            parts.push({ type: 'text', text: msg?.text || '' });
        }

        return {
            id: msg?.uuid || node.id || `msg-${idx}`,
            role: node.type === 'user' ? 'user' : 'assistant',
            parts,
            createdAt: new Date(msg?.created_at || node.created_at || Date.now()),
        } as UIMessage;
    });
}
