// compelling demo scenarios for RLM visualization
// each scenario has a clear dataset + query that shows RLM's power

export interface DemoScenario {
    id: string;
    name: string;
    description: string;
    scale: string;
    query: string;
    expectedBehavior: string;
    generateContext: () => string;
}

// --- SCENARIO 1: Customer Feedback Analysis ---
// relatable, shows pattern finding across thousands of entries

function generateCustomerFeedback(count: number): string {
    const products = ['Mobile App', 'Web Dashboard', 'API', 'CLI Tool', 'Desktop App'];
    const issues = [
        { name: 'slow_loading', phrases: ['takes forever to load', 'loading is slow', 'too slow', 'performance issues', 'laggy'] },
        { name: 'crashes', phrases: ['keeps crashing', 'app crashed', 'unexpected shutdown', 'freezes', 'stops working'] },
        { name: 'ui_confusing', phrases: ['confusing interface', 'hard to navigate', 'cant find features', 'UI is messy', 'not intuitive'] },
        { name: 'missing_feature', phrases: ['need export feature', 'wish it had dark mode', 'missing search', 'no filters', 'needs API'] },
        { name: 'billing_issues', phrases: ['charged twice', 'billing error', 'wrong amount', 'cant cancel', 'payment failed'] },
        { name: 'great_product', phrases: ['love this app', 'works great', 'exactly what I needed', 'amazing product', 'highly recommend'] },
    ];

    const sentiments = ['frustrated', 'neutral', 'happy', 'angry', 'confused'];
    const dates = Array.from({ length: 90 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    });

    let seed = 42;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const lines: string[] = [
        '# Customer Feedback Dataset',
        `# Total entries: ${count}`,
        '# Format: ID | Date | Product | Sentiment | Feedback',
        '#',
        '# TASK: Analyze this feedback to find the top 3 most common issues',
        '# and calculate what percentage of feedback each issue represents.',
        '#',
    ];

    // distribute issues with known frequencies for verification
    // slow_loading: 25%, crashes: 20%, ui_confusing: 15%, missing_feature: 15%, billing: 10%, great: 15%
    const issueWeights = [0.25, 0.20, 0.15, 0.15, 0.10, 0.15];

    for (let i = 0; i < count; i++) {
        const id = `FB-${String(i + 1).padStart(5, '0')}`;
        const date = dates[Math.floor(random() * dates.length)];
        const product = products[Math.floor(random() * products.length)];

        // weighted issue selection
        let cumulative = 0;
        const roll = random();
        let issueIdx = 0;
        for (let j = 0; j < issueWeights.length; j++) {
            cumulative += issueWeights[j];
            if (roll < cumulative) {
                issueIdx = j;
                break;
            }
        }

        const issue = issues[issueIdx];
        const phrase = issue.phrases[Math.floor(random() * issue.phrases.length)];
        const sentiment = issue.name === 'great_product' ? 'happy' : sentiments[Math.floor(random() * 4)];

        // generate realistic feedback text
        const templates = [
            `The ${product} ${phrase}. Please fix this.`,
            `I've been using ${product} and ${phrase}. Very ${sentiment}.`,
            `${product}: ${phrase}. This is ${sentiment === 'happy' ? 'great' : 'frustrating'}.`,
            `Regarding ${product} - ${phrase}. ${sentiment === 'angry' ? 'Unacceptable!' : ''}`,
        ];
        const feedback = templates[Math.floor(random() * templates.length)];

        lines.push(`${id} | ${date} | ${product} | ${sentiment} | ${feedback}`);
    }

    return lines.join('\n');
}

// --- SCENARIO 2: Sales Data Analysis ---
// shows numerical aggregation across regions

function generateSalesData(count: number): string {
    const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
    const products = ['Enterprise Plan', 'Team Plan', 'Starter Plan', 'Add-on: Analytics', 'Add-on: Security'];
    const salesReps = ['Alice Chen', 'Bob Smith', 'Carol Davis', 'David Kim', 'Eva Martinez', 'Frank Johnson'];

    let seed = 123;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const lines: string[] = [
        '# Q4 Sales Transactions',
        `# Total transactions: ${count}`,
        '# Format: TXN_ID | Date | Region | Sales Rep | Product | Amount ($) | Status',
        '#',
        '# TASK: Calculate total revenue by region and identify the top-performing sales rep.',
        '#',
    ];

    for (let i = 0; i < count; i++) {
        const id = `TXN-${String(i + 1).padStart(6, '0')}`;

        // date in Q4
        const month = 10 + Math.floor(random() * 3);
        const day = 1 + Math.floor(random() * 28);
        const date = `2025-${month}-${String(day).padStart(2, '0')}`;

        const region = regions[Math.floor(random() * regions.length)];
        const rep = salesReps[Math.floor(random() * salesReps.length)];
        const product = products[Math.floor(random() * products.length)];

        // amount based on product
        let baseAmount = 0;
        if (product.includes('Enterprise')) baseAmount = 50000 + random() * 100000;
        else if (product.includes('Team')) baseAmount = 5000 + random() * 15000;
        else if (product.includes('Starter')) baseAmount = 500 + random() * 1500;
        else baseAmount = 1000 + random() * 5000;

        const amount = Math.round(baseAmount);
        const status = random() > 0.1 ? 'Closed Won' : 'Closed Lost';

        lines.push(`${id} | ${date} | ${region} | ${rep} | ${product} | ${amount} | ${status}`);
    }

    return lines.join('\n');
}

// --- SCENARIO 3: Log Analysis (Finding Errors) ---
// classic infra scenario, finding needles in haystack

function generateServerLogs(count: number): string {
    const services = ['api-gateway', 'auth-service', 'payment-service', 'user-service', 'notification-service'];
    const levels = ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'];
    const levelWeights = [0.60, 0.20, 0.10, 0.08, 0.02]; // errors are rare

    const errorMessages = [
        'Connection timeout to database',
        'Failed to authenticate user: invalid token',
        'Payment processing failed: insufficient funds',
        'Rate limit exceeded for IP',
        'Memory allocation failed',
        'Disk space critical',
        'SSL certificate expired',
        'Service dependency unavailable',
    ];

    const infoMessages = [
        'Request processed successfully',
        'User logged in',
        'Cache hit for key',
        'Health check passed',
        'Configuration reloaded',
        'Connection pool refreshed',
    ];

    let seed = 456;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const lines: string[] = [
        '# Server Logs - Production Cluster',
        `# Total entries: ${count}`,
        '# Format: Timestamp | Service | Level | Message | Request ID',
        '#',
        '# TASK: Find all ERROR and FATAL level logs, group them by service,',
        '# and identify which service has the most critical issues.',
        '#',
    ];

    const baseTime = new Date('2025-01-22T00:00:00Z').getTime();

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(baseTime + i * 100 + Math.floor(random() * 100)).toISOString();
        const service = services[Math.floor(random() * services.length)];

        // weighted level selection
        let cumulative = 0;
        const roll = random();
        let levelIdx = 0;
        for (let j = 0; j < levelWeights.length; j++) {
            cumulative += levelWeights[j];
            if (roll < cumulative) {
                levelIdx = j;
                break;
            }
        }

        const level = levels[levelIdx];
        const message =
            level === 'ERROR' || level === 'FATAL' || level === 'WARN'
                ? errorMessages[Math.floor(random() * errorMessages.length)]
                : infoMessages[Math.floor(random() * infoMessages.length)];

        const requestId = `req-${Math.random().toString(36).substring(2, 10)}`;

        lines.push(`${timestamp} | ${service} | ${level} | ${message} | ${requestId}`);
    }

    return lines.join('\n');
}

// --- SCENARIO 4: The Ultimate Demo - Multi-hop Reasoning ---
// shows RLM following chains of information

function generateKnowledgeBase(count: number): string {
    // create interconnected facts that require multi-hop reasoning
    const people = [
        { name: 'Alice Chen', role: 'CEO', company: 'TechCorp', reports_to: null },
        { name: 'Bob Smith', role: 'CTO', company: 'TechCorp', reports_to: 'Alice Chen' },
        { name: 'Carol Davis', role: 'VP Engineering', company: 'TechCorp', reports_to: 'Bob Smith' },
        { name: 'David Kim', role: 'Senior Engineer', company: 'TechCorp', reports_to: 'Carol Davis' },
        { name: 'Eva Martinez', role: 'CFO', company: 'TechCorp', reports_to: 'Alice Chen' },
        { name: 'Frank Johnson', role: 'VP Sales', company: 'TechCorp', reports_to: 'Alice Chen' },
    ];

    const projects = [
        { name: 'Project Alpha', lead: 'David Kim', budget: 500000, status: 'active' },
        { name: 'Project Beta', lead: 'Carol Davis', budget: 1200000, status: 'completed' },
        { name: 'Project Gamma', lead: 'Bob Smith', budget: 3000000, status: 'planning' },
    ];

    let seed = 789;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const lines: string[] = [
        '# Company Knowledge Base',
        `# Total facts: ~${count}`,
        '#',
        '# TASK: Answer the question: "What is the total budget of all projects',
        '# led by people who report (directly or indirectly) to Bob Smith?"',
        '#',
        '# This requires multi-hop reasoning:',
        '# 1. Find who Bob Smith is',
        '# 2. Find who reports to Bob Smith (directly and indirectly)',
        '# 3. Find projects led by those people',
        '# 4. Sum their budgets',
        '#',
    ];

    // add structured facts
    people.forEach((p) => {
        lines.push(`FACT: ${p.name} is the ${p.role} at ${p.company}`);
        if (p.reports_to) {
            lines.push(`FACT: ${p.name} reports to ${p.reports_to}`);
        }
    });

    projects.forEach((p) => {
        lines.push(`FACT: ${p.name} is led by ${p.lead}`);
        lines.push(`FACT: ${p.name} has a budget of $${p.budget.toLocaleString()}`);
        lines.push(`FACT: ${p.name} status is ${p.status}`);
    });

    // pad with noise facts
    const noiseTopics = ['office locations', 'meeting schedules', 'equipment inventory', 'policy updates'];
    for (let i = lines.length; i < count; i++) {
        const topic = noiseTopics[Math.floor(random() * noiseTopics.length)];
        lines.push(`FACT: [${topic}] Entry #${i} - Lorem ipsum data point for padding context.`);
    }

    return lines.join('\n');
}

// --- EXPORT ALL SCENARIOS ---

export const DEMO_SCENARIOS: DemoScenario[] = [
    {
        id: 'customer-feedback-1k',
        name: 'Customer Feedback (1K)',
        description: 'Analyze 1,000 customer feedback entries to find top issues',
        scale: '~50KB',
        query: 'Analyze this customer feedback data. Find the top 3 most common issues mentioned and calculate what percentage of total feedback each issue represents. Be specific about the issue categories you identify.',
        expectedBehavior: 'RLM will chunk feedback, have sub-LLMs categorize each chunk, then aggregate results',
        generateContext: () => generateCustomerFeedback(1000),
    },
    {
        id: 'customer-feedback-10k',
        name: 'Customer Feedback (10K)',
        description: 'Analyze 10,000 customer feedback entries',
        scale: '~500KB',
        query: 'Analyze this customer feedback data. Find the top 3 most common issues mentioned and calculate what percentage of total feedback each issue represents. Also identify which product has the most complaints.',
        expectedBehavior: 'RLM will create multiple chunks, process in parallel-ish fashion, aggregate intelligently',
        generateContext: () => generateCustomerFeedback(10000),
    },
    {
        id: 'sales-analysis-5k',
        name: 'Sales Analysis (5K)',
        description: 'Analyze 5,000 sales transactions to find revenue by region',
        scale: '~300KB',
        query: 'Calculate the total revenue by region (only count "Closed Won" deals). Identify the top-performing sales rep by total revenue. Return exact dollar amounts.',
        expectedBehavior: 'RLM will process transaction data in chunks, aggregate numerical totals',
        generateContext: () => generateSalesData(5000),
    },
    {
        id: 'log-analysis-10k',
        name: 'Server Logs (10K)',
        description: 'Find errors in 10,000 log entries',
        scale: '~600KB',
        query: 'Find all ERROR and FATAL level log entries. Group them by service name and count occurrences. Which service has the most critical issues? What are the most common error messages?',
        expectedBehavior: 'RLM will filter logs, categorize errors, produce summary',
        generateContext: () => generateServerLogs(10000),
    },
    {
        id: 'log-analysis-100k',
        name: 'Server Logs (100K)',
        description: 'Find errors in 100,000 log entries - stress test',
        scale: '~6MB',
        query: 'Find all ERROR and FATAL level log entries. Group them by service name and count occurrences. Which service has the most critical issues?',
        expectedBehavior: 'RLM will handle large context by chunking, demonstrate scale',
        generateContext: () => generateServerLogs(100000),
    },
    {
        id: 'knowledge-reasoning',
        name: 'Multi-hop Reasoning',
        description: 'Answer questions requiring chain-of-thought across facts',
        scale: '~100KB',
        query: 'What is the total budget of all projects led by people who report (directly or indirectly) to Bob Smith? Show your reasoning step by step.',
        expectedBehavior: 'RLM will identify reporting chains, find relevant projects, sum budgets',
        generateContext: () => generateKnowledgeBase(2000),
    },
];

// get scenario by ID
export function getScenarioById(id: string): DemoScenario | undefined {
    return DEMO_SCENARIOS.find((s) => s.id === id);
}
