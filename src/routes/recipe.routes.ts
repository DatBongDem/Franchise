import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';

const router = Router();

router.get('/', RecipeController.getAll);
router.get('/:id/with-ingredients', RecipeController.getWithIngredientsById);
router.get('/:id', RecipeController.getById);
router.post('/', RecipeController.create);
router.put('/:id', RecipeController.update);
router.delete('/:id', RecipeController.delete);

export default router;
