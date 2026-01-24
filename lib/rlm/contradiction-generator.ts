// Contradiction Finder demo data generator
// Generates statements about a fictional world with planted contradictions

// seeded random for reproducibility
function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T {
    return arr[Math.floor(seededRandom(seed) * arr.length)];
}

// fictional world data
const KINGDOMS = ['Aldoria', 'Vethmar', 'Kestros', 'Lumina', 'Draketh', 'Sylvanor', 'Ironhold', 'Mistral'];
const RULERS = ['Marcus', 'Helena', 'Theron', 'Lyra', 'Cassius', 'Aria', 'Darius', 'Seraphina'];
const CITIES = ['Thornwood', 'Crystalfall', 'Irongate', 'Shadowmere', 'Goldenhaven', 'Stormwind', 'Ravenshollow', 'Sunspire'];
const RESOURCES = ['gold', 'iron', 'timber', 'grain', 'silver', 'gems', 'coal', 'silk'];
const EVENTS = ['founded', 'conquered', 'abandoned', 'rebuilt', 'flourished', 'declined'];
const RELATIONS = ['allied with', 'at war with', 'trading partner of', 'vassal of', 'rival of'];

interface Statement {
    id: string;
    text: string;
    category: string;
    entities: string[];
}

interface Contradiction {
    stmt1: string;
    stmt2: string;
    reason: string;
}

export interface ContradictionDataset {
    statements: string;
    contradictions: Contradiction[];
    totalStatements: number;
    totalContradictions: number;
}

// generate dataset with planted contradictions
export function generateContradictionDataset(
    statementCount: number = 500,
    contradictionRatio: number = 0.1
): ContradictionDataset {
    const statements: Statement[] = [];
    const contradictions: Contradiction[] = [];
    let seed = 42;

    const targetContradictions = Math.floor(statementCount * contradictionRatio);

    // generate base facts
    const facts: Map<string, string> = new Map();

    // assign rulers to kingdoms
    KINGDOMS.forEach((kingdom, i) => {
        facts.set(`ruler_${kingdom}`, RULERS[i % RULERS.length]);
        facts.set(`capital_${kingdom}`, CITIES[i % CITIES.length]);
        facts.set(`founded_${kingdom}`, String(1000 + i * 50));
        facts.set(`resource_${kingdom}`, RESOURCES[i % RESOURCES.length]);
    });

    // generate consistent statements
    let stmtId = 1;

    // kingdom facts
    KINGDOMS.forEach((kingdom) => {
        const ruler = facts.get(`ruler_${kingdom}`);
        const capital = facts.get(`capital_${kingdom}`);
        const founded = facts.get(`founded_${kingdom}`);
        const resource = facts.get(`resource_${kingdom}`);

        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text: `The ruler of ${kingdom} is ${ruler}.`,
            category: 'ruler',
            entities: [kingdom, ruler!],
        });

        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text: `The capital of ${kingdom} is ${capital}.`,
            category: 'capital',
            entities: [kingdom, capital!],
        });

        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text: `${kingdom} was founded in the year ${founded}.`,
            category: 'founding',
            entities: [kingdom],
        });

        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text: `${kingdom} is known for its ${resource} production.`,
            category: 'resource',
            entities: [kingdom, resource!],
        });
    });

    // relations between kingdoms
    for (let i = 0; i < KINGDOMS.length - 1; i++) {
        const relation = pick(RELATIONS, seed++);
        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text: `${KINGDOMS[i]} is ${relation} ${KINGDOMS[i + 1]}.`,
            category: 'relation',
            entities: [KINGDOMS[i], KINGDOMS[i + 1]],
        });
    }

    // fill with more varied statements until we reach target
    while (statements.length < statementCount - targetContradictions * 2) {
        const kingdom = pick(KINGDOMS, seed++);
        const city = pick(CITIES, seed++);
        const year = 1000 + Math.floor(seededRandom(seed++) * 500);
        const event = pick(EVENTS, seed++);
        const ruler = pick(RULERS, seed++);
        const resource = pick(RESOURCES, seed++);

        const templates = [
            `${city} in ${kingdom} was ${event} in ${year}.`,
            `${ruler} visited ${city} during the ${year} festival.`,
            `The ${resource} mines of ${kingdom} produced 1000 tons in ${year}.`,
            `A great storm hit ${kingdom} in the year ${year}.`,
            `${ruler} signed a treaty in ${city} in ${year}.`,
            `The population of ${city} reached 50000 by ${year}.`,
            `${kingdom} exported ${resource} to neighboring realms in ${year}.`,
            `The university of ${city} was established in ${year}.`,
        ];

        const text = pick(templates, seed++);
        statements.push({
            id: `STMT_${String(stmtId++).padStart(5, '0')}`,
            text,
            category: 'event',
            entities: [kingdom, city],
        });
    }

    // NOW ADD CONTRADICTIONS
    // each contradiction is a pair of statements that directly conflict

    for (let c = 0; c < targetContradictions; c++) {
        const contradictionType = c % 5;

        let stmt1Text: string;
        let stmt2Text: string;
        let reason: string;

        switch (contradictionType) {
            case 0: {
                // ruler contradiction
                const kingdom = pick(KINGDOMS, seed++);
                const ruler1 = pick(RULERS, seed++);
                let ruler2 = pick(RULERS, seed++);
                while (ruler2 === ruler1) ruler2 = pick(RULERS, seed++);

                stmt1Text = `${ruler1} has been the ruler of ${kingdom} since birth.`;
                stmt2Text = `${kingdom} has never had a hereditary ruler; all leaders are elected.`;
                reason = `${kingdom} cannot have both a birth-ruler and only elected leaders`;
                break;
            }
            case 1: {
                // founding date contradiction
                const kingdom = pick(KINGDOMS, seed++);
                const year1 = 1000 + Math.floor(seededRandom(seed++) * 200);
                const year2 = year1 + 500;

                stmt1Text = `${kingdom} was established in ${year1}, making it the oldest kingdom.`;
                stmt2Text = `${kingdom} did not exist until ${year2}, founded after the Great War.`;
                reason = `${kingdom} cannot be founded in both ${year1} and ${year2}`;
                break;
            }
            case 2: {
                // geographic contradiction
                const city = pick(CITIES, seed++);
                const kingdom1 = pick(KINGDOMS, seed++);
                let kingdom2 = pick(KINGDOMS, seed++);
                while (kingdom2 === kingdom1) kingdom2 = pick(KINGDOMS, seed++);

                stmt1Text = `${city} is located in the heart of ${kingdom1}.`;
                stmt2Text = `${city} has always been part of ${kingdom2}, never ${kingdom1}.`;
                reason = `${city} cannot be in both ${kingdom1} and ${kingdom2}`;
                break;
            }
            case 3: {
                // existence contradiction
                const entity = pick([...CITIES, ...KINGDOMS], seed++);
                const year = 1200 + Math.floor(seededRandom(seed++) * 300);

                stmt1Text = `${entity} was completely destroyed in ${year} and never rebuilt.`;
                stmt2Text = `${entity} has existed continuously for over 1000 years without interruption.`;
                reason = `${entity} cannot be both destroyed and continuously existing`;
                break;
            }
            case 4: {
                // relation contradiction
                const k1 = pick(KINGDOMS, seed++);
                let k2 = pick(KINGDOMS, seed++);
                while (k2 === k1) k2 = pick(KINGDOMS, seed++);

                stmt1Text = `${k1} and ${k2} have been at war for 200 years without ceasefire.`;
                stmt2Text = `${k1} and ${k2} have maintained peaceful relations throughout history.`;
                reason = `${k1} and ${k2} cannot be both at perpetual war and always peaceful`;
                break;
            }
            default: {
                const kingdom = pick(KINGDOMS, seed++);
                stmt1Text = `${kingdom} has vast gold reserves.`;
                stmt2Text = `${kingdom} has no gold and never has.`;
                reason = `${kingdom} cannot both have and not have gold`;
            }
        }

        const id1 = `STMT_${String(stmtId++).padStart(5, '0')}`;
        const id2 = `STMT_${String(stmtId++).padStart(5, '0')}`;

        statements.push({
            id: id1,
            text: stmt1Text,
            category: 'contradiction',
            entities: [],
        });

        statements.push({
            id: id2,
            text: stmt2Text,
            category: 'contradiction',
            entities: [],
        });

        contradictions.push({
            stmt1: id1,
            stmt2: id2,
            reason,
        });
    }

    // shuffle statements
    for (let i = statements.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed++) * (i + 1));
        [statements[i], statements[j]] = [statements[j], statements[i]];
    }

    // format as string
    const header = [
        '# Fictional World Knowledge Base',
        `# Total statements: ${statements.length}`,
        `# Task: Find all pairs of statements that contradict each other`,
        '#',
        '# Format: STMT_ID: statement text',
        '#',
    ];

    const body = statements.map((s) => `${s.id}: ${s.text}`);

    return {
        statements: [...header, ...body].join('\n'),
        contradictions,
        totalStatements: statements.length,
        totalContradictions: contradictions.length,
    };
}

// smaller version for quick testing
export function generateQuickContradictionTest(): ContradictionDataset {
    return generateContradictionDataset(50, 0.2); // 50 statements, ~10 contradictions
}
