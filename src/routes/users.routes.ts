import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { upload } from '../middlewares/upload.middleware';
import { Roles } from '../constants/roles.enum';

const router = Router();

// Public routes
router.post('/login', UsersController.login);
router.post('/logout', UsersController.logout);

// Authenticated routes
router.get('/whoami', authMiddleware, UsersController.whoAmI);
router.get('/me', authMiddleware, UsersController.getMe);
router.patch('/avatar', authMiddleware, upload.single('file'), UsersController.uploadAvatar);

// Admin & Manager routes
router.get('/', authMiddleware, authorizeRoles(Roles.ADMIN, Roles.MANAGER), UsersController.getAll);
router.get('/:id', authMiddleware, authorizeRoles(Roles.ADMIN, Roles.MANAGER), UsersController.getById);

// Admin only routes
router.post('/', authMiddleware, authorizeRoles(Roles.ADMIN), UsersController.create);
router.put('/:id', authMiddleware, authorizeRoles(Roles.ADMIN), UsersController.update);
router.delete('/:id', authMiddleware, authorizeRoles(Roles.ADMIN), UsersController.delete);
router.put('/:id/toggle-status', authMiddleware, authorizeRoles(Roles.ADMIN), UsersController.toggleStatus);

export default router;
