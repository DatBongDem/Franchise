import app from './app';
import { config } from './config/env';
import { getPool } from './config/db';
import { seedDatabase } from './seed';

async function startServer() {
    try {
        console.log('[Server] Connecting to SQL Server database...');
        await getPool();

        console.log('[Server] Checking and seeding initial data...');
        await seedDatabase();

        app.listen(config.port, () => {
            console.log(`\n======================================================`);
            console.log(`  🚀 FranchiseStore API is running!`);
            console.log(`  🌐 Server URL: http://localhost:${config.port}`);
            console.log(`  📖 Swagger UI: http://localhost:${config.port}/swagger`);
            console.log(`======================================================\n`);
        });
    } catch (err: any) {
        console.error('[Server] Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();
