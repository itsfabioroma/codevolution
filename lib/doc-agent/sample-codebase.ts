// generates a sample codebase for the self-learning docs demo

const SAMPLE_FILES = [
    {
        path: 'src/index.ts',
        content: `import { App } from './app';
import { config } from './config';

const app = new App(config);
app.start();

export { App, config };`,
    },
    {
        path: 'src/app.ts',
        content: `import { Router } from './router';
import { Database } from './db';
import { Logger } from './utils/logger';

export interface AppConfig {
    port: number;
    dbUrl: string;
    logLevel: 'debug' | 'info' | 'error';
}

export class App {
    private router: Router;
    private db: Database;
    private logger: Logger;

    constructor(private config: AppConfig) {
        this.logger = new Logger(config.logLevel);
        this.db = new Database(config.dbUrl);
        this.router = new Router();
    }

    async start(): Promise<void> {
        await this.db.connect();
        this.logger.info(\`Server starting on port \${this.config.port}\`);
        this.router.listen(this.config.port);
    }

    async stop(): Promise<void> {
        await this.db.disconnect();
        this.logger.info('Server stopped');
    }
}`,
    },
    {
        path: 'src/router.ts',
        content: `import { UserController } from './controllers/user';
import { AuthMiddleware } from './middleware/auth';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Route {
    method: HttpMethod;
    path: string;
    handler: (req: Request, res: Response) => Promise<void>;
}

export class Router {
    private routes: Route[] = [];
    private middleware: AuthMiddleware;

    constructor() {
        this.middleware = new AuthMiddleware();
        this.registerRoutes();
    }

    private registerRoutes(): void {
        const userController = new UserController();

        this.routes.push(
            { method: 'GET', path: '/users', handler: userController.list },
            { method: 'GET', path: '/users/:id', handler: userController.get },
            { method: 'POST', path: '/users', handler: userController.create },
            { method: 'DELETE', path: '/users/:id', handler: userController.delete },
        );
    }

    listen(port: number): void {
        console.log(\`Router listening on port \${port}\`);
    }
}`,
    },
    {
        path: 'src/db.ts',
        content: `export interface QueryResult<T> {
    rows: T[];
    count: number;
}

export class Database {
    private connected = false;

    constructor(private url: string) {}

    async connect(): Promise<void> {
        console.log(\`Connecting to \${this.url}\`);
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
        if (!this.connected) throw new Error('Not connected');
        return { rows: [], count: 0 };
    }

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        try {
            await this.query('BEGIN');
            const result = await fn();
            await this.query('COMMIT');
            return result;
        } catch (err) {
            await this.query('ROLLBACK');
            throw err;
        }
    }
}`,
    },
    {
        path: 'src/controllers/user.ts',
        content: `import { Database } from '../db';

export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
}

export class UserController {
    private db: Database;

    constructor() {
        this.db = new Database(process.env.DB_URL!);
    }

    async list(req: Request, res: Response): Promise<void> {
        const result = await this.db.query<User>('SELECT * FROM users');
        res.json(result.rows);
    }

    async get(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await this.db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
        res.json(result.rows[0]);
    }

    async create(req: Request, res: Response): Promise<void> {
        const { email, name } = req.body;
        await this.db.query('INSERT INTO users (email, name) VALUES ($1, $2)', [email, name]);
        res.status(201).json({ success: true });
    }

    async delete(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        await this.db.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    }
}`,
    },
    {
        path: 'src/middleware/auth.ts',
        content: `import { verify } from 'jsonwebtoken';

export interface AuthToken {
    userId: string;
    exp: number;
}

export class AuthMiddleware {
    private secret: string;

    constructor() {
        this.secret = process.env.JWT_SECRET || 'dev-secret';
    }

    async authenticate(req: Request): Promise<AuthToken | null> {
        const header = req.headers.get('Authorization');
        if (!header?.startsWith('Bearer ')) return null;

        const token = header.slice(7);
        try {
            return verify(token, this.secret) as AuthToken;
        } catch {
            return null;
        }
    }

    requireAuth(handler: Function) {
        return async (req: Request, res: Response) => {
            const auth = await this.authenticate(req);
            if (!auth) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            req.auth = auth;
            return handler(req, res);
        };
    }
}`,
    },
    {
        path: 'src/utils/logger.ts',
        content: `export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

export class Logger {
    private level: number;

    constructor(level: LogLevel = 'info') {
        this.level = LEVELS[level];
    }

    private log(level: LogLevel, message: string, meta?: object): void {
        if (LEVELS[level] < this.level) return;

        const timestamp = new Date().toISOString();
        const entry = { timestamp, level, message, ...meta };
        console.log(JSON.stringify(entry));
    }

    debug(message: string, meta?: object): void {
        this.log('debug', message, meta);
    }

    info(message: string, meta?: object): void {
        this.log('info', message, meta);
    }

    warn(message: string, meta?: object): void {
        this.log('warn', message, meta);
    }

    error(message: string, meta?: object): void {
        this.log('error', message, meta);
    }
}`,
    },
    {
        path: 'src/config.ts',
        content: `import { AppConfig } from './app';

export const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000'),
    dbUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/app',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'error') || 'info',
};`,
    },
];

// generate sample codebase as JSON context
export function generateSampleCodebase(): string {
    const files = SAMPLE_FILES.map((f) => ({
        path: f.path,
        content: f.content,
        language: 'typescript',
        lineCount: f.content.split('\n').length,
    }));

    return JSON.stringify({ files, projectRoot: '/sample-app' }, null, 2);
}
