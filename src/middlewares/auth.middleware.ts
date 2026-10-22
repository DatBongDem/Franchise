import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    idStore: string;
    role: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized: Missing or invalid token format.' });
        return;
    }

    const token = authHeader.substring(7).trim();

    try {
        const decoded = jwt.verify(token, config.jwt.secret, {
            issuer: config.jwt.issuer,
            audience: config.jwt.audience
        }) as any;

        req.user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            name: decoded.name,
            idStore: decoded.IdStore || decoded.idStore,
            role: decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role
        };

        next();
    } catch (err: any) {
        res.status(401).json({ message: 'Unauthorized: Invalid or expired token.', error: err.message });
        return;
    }
}
