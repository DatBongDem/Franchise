import { Router } from 'express';
import { IngredientController } from '../controllers/ingredient.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Roles } from '../constants/roles.enum';

const router = Router();

// Note: Order of routes matters! Place /ingredient-history before /:id
router.get('/ingredient-history', authMiddleware, authorizeRoles(Roles.KITCHENSTAFF), IngredientController.getIngredientHistory);
router.get('/:orderId/ingredients', authMiddleware, authorizeRoles(Roles.KITCHENSTAFF), IngredientController.getCookingIngredients);

router.get('/', IngredientController.getAll);
router.get('/:id', IngredientController.getById);
router.post('/', IngredientController.create);
router.put('/:id', IngredientController.update);
router.delete('/:id', IngredientController.delete);

export default router;
