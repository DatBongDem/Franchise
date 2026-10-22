import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne } from '../config/db';
import { config } from '../config/env';

export class AuthService {
    static async login(gmail: string, password: string): Promise<{ token?: string; message?: string }> {
        const user = await queryOne('SELECT * FROM Users WHERE Gmail = @gmail', { gmail });
        if (!user) {
            return { message: 'Invalid credentials.' };
        }

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return { message: 'Invalid credentials.' };
        }

        if (user.Status === 'Blocked') {
            return { message: 'Your account has been blocked.' };
        }

        const token = this.generateToken(user);
        return { token };
    }

    static generateToken(user: any): string {
        const payload = {
            sub: user.Id,
            email: user.Gmail,
            name: user.Name,
            IdStore: user.IdStore,
            role: user.Role,
            'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': user.Role
        };

        return jwt.sign(payload, config.jwt.secret, {
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
            expiresIn: '1h'
        });
    }
}
