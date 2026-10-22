import sql from 'mssql';
import { config } from './env';

const sqlConfig: sql.config = {
    server: config.db.server,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    options: {
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: config.db.instanceName
    },
    pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

if (config.db.port && !config.db.instanceName) {
    sqlConfig.port = config.db.port;
}

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
    if (!pool) {
        try {
            pool = await new sql.ConnectionPool(sqlConfig).connect();
            console.log(`[Database] Connected to SQL Server database '${config.db.database}' successfully.`);
        } catch (err: any) {
            console.error('[Database] Failed to connect to SQL Server:', err.message);
            throw err;
        }
    }
    return pool;
}

export async function query<T = any>(queryText: string, params: Record<string, any> = {}): Promise<T[]> {
    const connection = await getPool();
    const request = connection.request();
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    const result = await request.query(queryText);
    return result.recordset as T[];
}

export async function queryOne<T = any>(queryText: string, params: Record<string, any> = {}): Promise<T | null> {
    const rows = await query<T>(queryText, params);
    return rows.length > 0 ? rows[0] : null;
}

export async function execute(queryText: string, params: Record<string, any> = {}): Promise<sql.IResult<any>> {
    const connection = await getPool();
    const request = connection.request();
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    return await request.query(queryText);
}

export { sql };
