import { Router } from 'express';
import { ProductBatchesController } from '../controllers/productBatches.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Inventory endpoints (Place before :id params)
router.get('/inventory/all', authMiddleware, ProductBatchesController.getAllProductsInventory);
router.get('/inventory/expired-summary', authMiddleware, ProductBatchesController.getExpiredInventorySummary);
router.get('/inventory/expired-by-date/:date', authMiddleware, ProductBatchesController.getExpiredInventoryByDate);
router.get('/products/:productId/batches', authMiddleware, ProductBatchesController.getProductBatchesByProductId);

// Store-specific inventory & shrinkage
router.get('/:storeId/shrinkage', optionalAuthMiddleware, ProductBatchesController.getStoreShrinkage);
router.get('/:storeId/inventory', authMiddleware, ProductBatchesController.getStoreInventory);

// Product batch in order CRUD
router.post('/', authMiddleware, ProductBatchesController.create);
router.put('/:productId', authMiddleware, ProductBatchesController.update);

export default router;
