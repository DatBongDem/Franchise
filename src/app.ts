import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes';
import { setupSwagger } from './swagger';

const app = express();

// CORS configuration matching C# AllowFrontend (Vite dev server)
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI at /swagger and /api-docs
setupSwagger(app);

// Root health endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'FranchiseStore API (Node.js Express) is running',
        swagger: '/swagger',
        version: '1.0.0'
    });
});

// Master routes
app.use('/api', routes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Unhandled Error]:', err);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

export default app;
