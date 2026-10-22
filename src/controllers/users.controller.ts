import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export class UsersController {
    static async login(req: Request, res: Response): Promise<void> {
        try {
            const { gmail, password, Gmail, Password } = req.body;
            const emailInput = gmail || Gmail;
            const passwordInput = password || Password;

            if (!emailInput || !passwordInput) {
                res.status(400).json({ message: 'Gmail and Password are required.' });
                return;
            }

            const result = await AuthService.login(emailInput, passwordInput);
            if (!result.token) {
                res.status(401).json({ message: result.message || 'Invalid credentials' });
                return;
            }

            res.json(result);
        } catch (error: any) {
            console.error('[UsersController.login] Error:', error);
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static logout(req: Request, res: Response): void {
        res.json({ message: 'Logout successful. Please discard the token on the client side.' });
    }

    static whoAmI(req: Request, res: Response): void {
        res.json({
            isAuthenticated: !!req.user,
            roles: req.user ? [req.user.role] : []
        });
    }

    static async getMe(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ message: 'User ID not found in token.' });
                return;
            }

            const user = await UserService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const users = await UserService.getAllUsers();
            res.json(users);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const user = await UserService.getUserById(req.params.id);
            if (!user) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const user = await UserService.createUser(req.body);
            res.status(201).json(user);
        } catch (error: any) {
            console.error('[UsersController.create] Error:', error);
            res.status(500).json({ message: 'An internal error occurred.', error: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const success = await UserService.updateUser(req.params.id, req.body);
            if (!success) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await UserService.deleteUser(req.params.id);
            if (!success) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async toggleStatus(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            // The C# {id:guid} route does not match an invalid ID.
            res.status(404).send();
            return;
        }
        try {
            const newStatus = await UserService.toggleUserStatus(req.params.id);
            if (!newStatus) {
                res.status(404).send();
                return;
            }
            res.json({
                message: newStatus === 'Blocked' ? 'Account has been blocked.' : 'Account has been recovered.',
                status: newStatus
            });
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async uploadAvatar(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded.' });
                return;
            }

            const avatarUrl = await UserService.updateAvatar(req.user!.id, req.file);
            if (!avatarUrl) {
                res.status(400).json({ message: 'Failed to upload avatar.' });
                return;
            }

            res.json({ avatar: avatarUrl });
        } catch (error: any) {
            res.status(500).json({ message: 'An internal error occurred.', error: error.message });
        }
    }
}
