import { Router } from 'express';
import usersRoutes from './users.routes';
import storeRoutes from './store.routes';
import categoryRoutes from './category.routes';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';
import deliveryRoutes from './delivery.routes';
import productBatchesRoutes from './productBatches.routes';
import billsRoutes from './bills.routes';
import ingredientRoutes from './ingredient.routes';
import recipeRoutes from './recipe.routes';
import quantitativeRoutes from './quantitative.routes';

const router = Router();

router.use('/users', usersRoutes);
router.use('/store', storeRoutes);
router.use('/category', categoryRoutes);
router.use('/product', productRoutes);
router.use('/order', orderRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/productbatches', productBatchesRoutes);
router.use('/bills', billsRoutes);
router.use('/ingredient', ingredientRoutes);
router.use('/recipe', recipeRoutes);
router.use('/quantitative', quantitativeRoutes);

export default router;
