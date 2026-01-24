// OOLONG-Pairs mock data generator
// Based on the OOLONG benchmark from the RLMs paper (quadratic pairwise aggregation)

// simple seeded random for reproducibility
function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// generate OOLONG-Pairs format data
// format: each line is "pair_id: value_a, value_b"
// task: count pairs where abs(value_a - value_b) == 10
export function generateOolongPairs(count: number, targetDiff = 10, matchRatio = 0.1): string {
    const lines: string[] = [];
    let seed = 42;

    // determine how many should match
    const matchCount = Math.floor(count * matchRatio);
    const matchIndices = new Set<number>();

    // randomly select which indices will be matches
    while (matchIndices.size < matchCount) {
        const idx = Math.floor(seededRandom(seed++) * count);
        matchIndices.add(idx);
    }

    for (let i = 0; i < count; i++) {
        const pairId = `P${String(i + 1).padStart(String(count).length, '0')}`;

        let valueA: number;
        let valueB: number;

        if (matchIndices.has(i)) {
            // create a matching pair (diff = targetDiff)
            valueA = Math.floor(seededRandom(seed++) * 1000);
            valueB = seededRandom(seed++) > 0.5 ? valueA + targetDiff : valueA - targetDiff;
        } else {
            // create a non-matching pair (diff != targetDiff)
            valueA = Math.floor(seededRandom(seed++) * 1000);
            // ensure diff is not exactly targetDiff
            do {
                valueB = Math.floor(seededRandom(seed++) * 1000);
            } while (Math.abs(valueA - valueB) === targetDiff);
        }

        lines.push(`${pairId}: ${valueA}, ${valueB}`);
    }

    // shuffle to mix matching and non-matching
    for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed++) * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
    }

    // add header with metadata
    const header = [
        '# OOLONG-Pairs Dataset',
        `# Total pairs: ${count}`,
        `# Target difference: ${targetDiff}`,
        `# Expected matches: ~${matchCount} (${(matchRatio * 100).toFixed(0)}%)`,
        '# Format: pair_id: value_a, value_b',
        '#',
    ];

    return [...header, ...lines].join('\n');
}

// generate multi-hop question data (for BrowseComp-style tasks)
export function generateMultiHopDocs(docCount: number): string {
    const docs: string[] = [];
    let seed = 123;

    const entities = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry'];
    const relations = ['works at', 'lives in', 'is friends with', 'manages', 'reports to'];
    const places = ['NYC', 'LA', 'Chicago', 'Boston', 'Seattle', 'Miami', 'Denver', 'Austin'];
    const companies = ['Acme Corp', 'TechStart', 'GlobalFin', 'MegaRetail', 'DataDriven', 'CloudNine'];

    for (let i = 0; i < docCount; i++) {
        const entity = entities[Math.floor(seededRandom(seed++) * entities.length)];
        const relation = relations[Math.floor(seededRandom(seed++) * relations.length)];
        const target =
            relation === 'lives in'
                ? places[Math.floor(seededRandom(seed++) * places.length)]
                : relation === 'works at'
                  ? companies[Math.floor(seededRandom(seed++) * companies.length)]
                  : entities[Math.floor(seededRandom(seed++) * entities.length)];

        docs.push(`DOC_${i + 1}: ${entity} ${relation} ${target}.`);
    }

    return docs.join('\n');
}

// generate needle-in-haystack data (S-NIAH style)
export function generateNeedleHaystack(
    haystackSize: number,
    needleContent: string = 'SECRET_CODE_12345',
    needlePosition: 'start' | 'middle' | 'end' | 'random' = 'middle'
): string {
    const lines: string[] = [];
    let seed = 456;

    // generate random haystack lines
    const words = [
        'the',
        'quick',
        'brown',
        'fox',
        'jumps',
        'over',
        'lazy',
        'dog',
        'lorem',
        'ipsum',
        'dolor',
        'sit',
        'amet',
        'consectetur',
        'adipiscing',
        'elit',
    ];

    for (let i = 0; i < haystackSize; i++) {
        const lineLength = 5 + Math.floor(seededRandom(seed++) * 10);
        const lineWords = [];
        for (let j = 0; j < lineLength; j++) {
            lineWords.push(words[Math.floor(seededRandom(seed++) * words.length)]);
        }
        lines.push(lineWords.join(' '));
    }

    // insert needle
    let needleIdx: number;
    switch (needlePosition) {
        case 'start':
            needleIdx = Math.floor(haystackSize * 0.1);
            break;
        case 'end':
            needleIdx = Math.floor(haystackSize * 0.9);
            break;
        case 'middle':
            needleIdx = Math.floor(haystackSize * 0.5);
            break;
        case 'random':
            needleIdx = Math.floor(seededRandom(seed++) * haystackSize);
            break;
    }

    lines.splice(needleIdx, 0, `IMPORTANT: The answer is ${needleContent}`);

    return lines.join('\n');
}
