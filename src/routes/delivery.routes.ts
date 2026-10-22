import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Roles } from '../constants/roles.enum';

const router = Router();

router.get('/', authMiddleware, authorizeRoles(Roles.SUPPLYCOORDINATOR, Roles.KITCHENSTAFF), DeliveryController.getAvailableOrders);
router.put('/:orderId/pickup', authMiddleware, authorizeRoles(Roles.SUPPLYCOORDINATOR), DeliveryController.pickUpOrder);
router.put('/:orderId/send-to-kitchen', authMiddleware, authorizeRoles(Roles.SUPPLYCOORDINATOR), DeliveryController.sendToKitchen);
router.put('/:orderId/take-from-kitchen', authMiddleware, authorizeRoles(Roles.SUPPLYCOORDINATOR), DeliveryController.takeFromKitchen);
// C# ArriveAtStore has no Authorize attribute on the action or controller.
router.put('/:orderId/arrive-at-store', DeliveryController.arriveAtStore);

export default router;
