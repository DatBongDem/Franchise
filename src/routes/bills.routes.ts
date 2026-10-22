import { Router } from 'express';
import { BillsController } from '../controllers/bills.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Roles } from '../constants/roles.enum';

const router = Router();

// Store revenue
router.get('/stores/:storeId/revenue', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.MANAGER, Roles.ADMIN), BillsController.getStoreRevenue);

// Billing history by store
router.get('/billingHistory/:storeId', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.MANAGER, Roles.ADMIN), BillsController.getBillingsHistoryStore);

// Billing history by staff
router.get('/history', authMiddleware, authorizeRoles(Roles.STORESTAFF, Roles.MANAGER, Roles.ADMIN), BillsController.getBillingHistory);

// Print bill
router.get('/:id/print', BillsController.printBill);

// Create bill
router.post('/', authMiddleware, authorizeRoles(Roles.STORESTAFF), BillsController.createBill);

export default router;
