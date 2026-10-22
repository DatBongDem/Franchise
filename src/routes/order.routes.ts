import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Roles } from '../constants/roles.enum';

const router = Router();

// Order history by store
router.get('/order-history/:storeId', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.MANAGER), OrderController.getOrdersHistoryStore);

// Check creating order
router.get('/check-creating', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.checkCreating);

// Cooking orders
router.get('/orders', authMiddleware, OrderController.getCookingOrders);

// Orders by store
router.get('/by-store', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.getOrdersByStore);

// Kitchen cooking endpoints
router.put('/:orderId/start-cooking', authMiddleware, authorizeRoles(Roles.KITCHENSTAFF), OrderController.startCooking);
router.put('/:orderId/finish-cooking', authMiddleware, authorizeRoles(Roles.KITCHENSTAFF), OrderController.finishCooking);

// Status update endpoints
router.put('/:orderId/sent-to-pending', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.sendToPending);
router.put('/:orderId/complete', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.completeOrder);
router.put('/:id/cancel', authMiddleware, OrderController.cancelOrder);

// Detail & CRUD endpoints
router.get('/:orderId/details', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.SUPPLYCOORDINATOR, Roles.KITCHENSTAFF), OrderController.getOrderDetails);
router.get('/:orderId', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.getOrderById);
router.put('/:orderId', authMiddleware, authorizeRoles(Roles.STORESTAFF), OrderController.updateOrder);
router.get('/', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.KITCHENSTAFF, Roles.MANAGER, Roles.ADMIN), OrderController.getAllOrders);

export default router;
