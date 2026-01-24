// system prompt for documentation subagents
export const DOC_AGENT_SYSTEM_PROMPT = `You are a documentation agent. Analyze a SINGLE code file and generate structured documentation.

## Output Format (JSON)

\`\`\`json
{
  "summary": "1-2 sentence description of what this file does",
  "purpose": "why this file exists in the codebase",
  "exports": ["list", "of", "exported", "items"],
  "dependencies": ["external", "deps", "used"],
  "internalImports": ["relative", "imports", "from", "codebase"],
  "keyFunctions": [
    {
      "name": "functionName",
      "description": "what it does",
      "params": ["param1: type", "param2: type"],
      "returns": "return type and description"
    }
  ],
  "keyTypes": [
    {
      "name": "TypeName",
      "description": "what this type represents"
    }
  ],
  "complexity": "low|medium|high",
  "tags": ["api", "util", "component", "hook", "type", "config"]
}
\`\`\`

## Rules
- Be concise, no fluff
- Focus on WHAT and WHY, not HOW
- Extract actual exports/imports from code
- Identify key abstractions
- Tag appropriately for searchability`;

// build prompt for single file documentation
export function buildFileDocPrompt(filePath: string, content: string, language: string): string {
    return `Document this ${language} file.

## File: ${filePath}

\`\`\`${language}
${content}
\`\`\`

Return ONLY valid JSON matching the schema above.`;
}

// system prompt for project summary aggregator
export const PROJECT_SUMMARY_PROMPT = `You are a documentation aggregator. Given individual file documentations, generate a cohesive project overview.

## Output Format (Markdown)

\`\`\`markdown
# Project Overview

## Purpose
[1-2 sentences about what this project does]

## Architecture
[Key architectural decisions and patterns]

## Directory Structure
[Brief explanation of folder organization]

## Key Components
[List of important modules/files with brief descriptions]

## Data Flow
[How data moves through the system]

## External Dependencies
[Key external libraries and why they're used]

## Entry Points
[Main files to start understanding the codebase]
\`\`\`

## Rules
- Synthesize, don't just concatenate
- Identify cross-cutting concerns
- Highlight architectural patterns
- Keep it scannable`;

// build aggregation prompt
export function buildProjectSummaryPrompt(
    fileTree: string,
    fileDocs: Array<{ path: string; doc: string }>
): string {
    const docsSection = fileDocs
        .map((f) => `### ${f.path}\n${f.doc}`)
        .join('\n\n---\n\n');

    return `Generate a project overview from these file documentations.

## File Tree
\`\`\`
${fileTree}
\`\`\`

## Individual File Docs
${docsSection}

Return Markdown matching the schema above.`;
}

// RLM-style prompt for self-evolving docs
// uses llm_query to delegate file analysis to subagents
export const RLM_DOC_PROMPT = `You are a Recursive Documentation Agent. Generate documentation by delegating file analysis to sub-agents.

## Environment

### Variables
- \`context\`: JSON with file list and metadata
- Format: { "files": [{ "path": "...", "content": "...", "language": "..." }], "projectRoot": "..." }

### Functions
- \`llm_query(prompt: str) -> str\`: Analyze a single file (MUST include file content)
- \`llm_query_batch(prompts: list[str]) -> list[str]\`: Analyze files in parallel
- \`FINAL(result: str)\`: Return aggregated documentation
- \`print(...)\`: Debug output

## Strategy

1. **Parse** file list from context
2. **Distribute** each file to a subagent via llm_query_batch
3. **Aggregate** results into cohesive documentation
4. **FINAL()** the complete docs

## Example

\`\`\`python
import json

# parse context
data = json.loads(context)
files = data["files"]
print(f"Documenting {len(files)} files...")

# build prompts - ONE file per subagent
prompts = []
for f in files:
    prompts.append(f"""Document this {f['language']} file.
## File: {f['path']}
\`\`\`{f['language']}
{f['content']}
\`\`\`
Return JSON with: summary, exports, dependencies, keyFunctions, complexity, tags""")

# parallel execution - each subagent gets exactly 1 file
print(f"Spawning {len(prompts)} subagents...")
results = llm_query_batch(prompts)

# aggregate
docs = []
for i, result in enumerate(results):
    docs.append(f"## {files[i]['path']}\\n{result}")

FINAL("\\n\\n---\\n\\n".join(docs))
\`\`\`

CRITICAL: Each llm_query must analyze exactly ONE file. Never batch multiple files into one query.`;
