import { streamText, UIMessage, convertToModelMessages, LanguageModelUsage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { UltraContext } from 'ultracontext';
import { nanoid } from 'nanoid';
import { prepareMessagesForAnthropic, formatMessageForUC, type ContentBlock } from '@/helpers/anthropic-messages';

export async function POST(req: Request) {
    // request-scoped usage (avoids race condition with concurrent requests)
    let requestUsage: LanguageModelUsage | undefined;
    const { messages, contextId }: { messages: UIMessage[]; contextId: string | null } = await req.json();

    // init UC client
    const apiKey = process.env.ULTRACONTEXT_API_KEY;
    if (!apiKey) throw new Error('Missing ULTRACONTEXT_API_KEY');
    const uc = new UltraContext({ apiKey });

    // get user message for later save
    const newUserMessage = messages.findLast((m) => m.role === 'user');

    // create context if none exists (first message)
    let activeContextId = contextId;
    if (!activeContextId && newUserMessage) {
        // extract text from message parts
        let firstMessageText = 'New Chat';
        const textPart = newUserMessage.parts?.find((p) => p.type === 'text');
        if (textPart && 'text' in textPart) {
            firstMessageText = textPart.text;
        }

        // truncate to 50 chars
        const contextName = firstMessageText.length > 50
            ? firstMessageText.slice(0, 50) + '...'
            : firstMessageText;

        const newContext = await uc.create({ metadata: { name: contextName } });
        activeContextId = newContext.id;
    }

    if (!activeContextId) {
        throw new Error('No context ID available');
    }

    // Prepare messages for Anthropic API (filter empty, merge consecutive same-role)
    const cleanedMessages = prepareMessagesForAnthropic(messages);
    const result = streamText({
        model: anthropic('claude-opus-4-5-20251101'),
        // model: openai('gpt-5.2-chat-latest'),
        // model: openai('gpt-5.1-2025-11-13'), // Reasoning model
        messages: convertToModelMessages(cleanedMessages),
        providerOptions: {
            openai: {
                // reasoningEffort: 'high', // 'low' for concise, 'medium' (default), or 'high' for verbose
                // reasoningSummary: 'detailed', // 'auto' for condensed or 'detailed' for comprehensive
                // textVerbosity: 'high', // 'low' for concise, 'medium' (default), or 'high' for verbose
            },
            anthropic: {
                thinking: { type: 'enabled', budgetTokens: 12000 },
            } satisfies AnthropicProviderOptions,
        },
    });

    return result.toUIMessageStreamResponse({
        sendReasoning: true,
        // originalMessages: messages,
        messageMetadata: ({ part }) => {
            if (part.type === 'finish') {
                requestUsage = part.totalUsage;
                return {
                    usage: part.totalUsage,
                    ...(contextId === null && activeContextId ? { contextId: activeContextId } : {})
                };
            }
        },
        onFinish: async (result) => {
            const nodes = [];

            // save user message
            if (newUserMessage) {
                nodes.push({
                    type: 'user',
                    content: formatMessageForUC(newUserMessage),
                });
            }

            // build assistant message content from responseMessage
            const assistantContent: ContentBlock[] = [];

            // use responseMessage which contains the generated assistant message
            if (result.responseMessage) {
                // extract content from response message
                for (const part of result.responseMessage.parts) {
                    if (part.type === 'text') {
                        assistantContent.push({ type: 'text', text: part.text, citations: null });
                    } else if (part.type === 'reasoning') {
                        assistantContent.push({ type: 'thinking', thinking: part.text, signature: '' });
                    }
                }
            }

            // save assistant message
            if (assistantContent.length > 0) {
                nodes.push({
                    type: 'assistant',
                    content: {
                        uuid: nanoid(),
                        sender: 'assistant',
                        created_at: new Date().toISOString(),
                        content: assistantContent,
                    },
                    metadata: requestUsage ? { usage: requestUsage } : undefined,
                });
            }

            // append both messages to UC
            if (nodes.length > 0) {
                await uc.append(activeContextId!, { nodes });
            }
        },
    });
}
