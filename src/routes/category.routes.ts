import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';

const router = Router();

router.post('/', CategoryController.create);
router.put('/:id', CategoryController.update);
router.get('/:id', CategoryController.getById);
router.get('/', CategoryController.getAll);
router.delete('/:id', CategoryController.delete);

export default router;
