import { Router } from 'express';
import { StoreController } from '../controllers/store.controller';

const router = Router();

router.get('/', StoreController.getAll);
router.get('/:id', StoreController.getById);
router.post('/', StoreController.create);
router.put('/:id', StoreController.update);
router.delete('/:id', StoreController.delete);

export default router;
