import { Request, Response, NextFunction } from 'express';

export function authorizeRoles(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
            return;
        }

        const userRole = (req.user.role || '').toUpperCase();
        const hasRole = allowedRoles.some(r => r.toUpperCase() === userRole);

        if (!hasRole) {
            res.status(403).json({
                message: `Forbidden: User role '${req.user.role}' does not have permission to access this resource.`
            });
            return;
        }

        next();
    };
}
