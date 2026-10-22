import { Router } from 'express';
import { QuantitativeController } from '../controllers/quantitative.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, QuantitativeController.getQuantitativesForStore);
router.put('/:productId', authMiddleware, QuantitativeController.updateQuantitative);

export default router;
