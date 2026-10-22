import { Request, Response } from 'express';
import { OrderInvalidStateError, OrderNotFoundError, OrderService } from '../services/order.service';

export class OrderController {
    static async getOrdersHistoryStore(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const storeId = req.params.storeId;
            const pageNumber = parseInt(req.query.PageNumber as string || req.query.pageNumber as string || '1', 10);
            const pageSize = parseInt(req.query.PageSize as string || req.query.pageSize as string || '10', 10);

            const { orders, totalRecords } = await OrderService.getOrdersHistoryAtStore(userId!, storeId, pageNumber, pageSize);
            res.json({
                status: 0,
                totalRecords,
                pageNumber,
                pageSize,
                data: orders,
                message: orders.length > 0 ? 'Get Orders history successfully' : 'No Orders history found'
            });
        } catch (error: any) {
            res.status(500).json({ message: 'An internal error occurred.', error: error.message });
        }
    }

    static async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            const order = await OrderService.getOrderById(req.params.orderId);
            if (!order) {
                res.status(404).json({ message: `Order with ID ${req.params.orderId} not found.` });
                return;
            }
            res.json(order);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getAllOrders(req: Request, res: Response): Promise<void> {
        try {
            const orders = await OrderService.getAllOrders();
            res.json(orders);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getOrdersByStore(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found in token.' });
                return;
            }
            const orders = await OrderService.getOrdersByStore(storeId);
            res.json(orders);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getOrderDetails(req: Request, res: Response): Promise<void> {
        try {
            const order = await OrderService.getOrderWithDetails(req.params.orderId);
            if (!order) {
                res.status(404).json({ message: `Order with ID ${req.params.orderId} not found.` });
                return;
            }
            res.json(order);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async updateOrder(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.updateOrder(req.params.orderId, req.body);
            res.json({ message: 'Order updated successfully' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async sendToPending(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.sendOrderToPending(req.params.orderId, req.user!.id);
            res.json({ message: 'Order sent to pending successfully' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async completeOrder(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.orderId)) {
            res.status(400).json({ message: 'Invalid order ID.' });
            return;
        }
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            res.status(400).json({ message: 'A request body is required.' });
            return;
        }
        const feedback = body.feedback !== undefined ? body.feedback : body.Feedback;
        if (feedback != null && typeof feedback !== 'string') {
            res.status(400).json({ message: 'Feedback must be a string or null.' });
            return;
        }
        try {
            await OrderService.completeOrder(req.params.orderId, feedback);
            res.json({ message: 'Order marked as completed successfully.' });
        } catch (error: any) {
            if (error instanceof OrderNotFoundError) {
                res.status(404).json({ message: error.message });
                return;
            }
            if (error instanceof OrderInvalidStateError) {
                res.status(400).json({ message: error.message });
                return;
            }
            res.status(500).json({ message: 'An error occurred while completing the order.', error: error.message });
        }
    }

    static async cancelOrder(req: Request, res: Response): Promise<void> {
        try {
            const reason = req.body.cancellationReason || req.body.CancellationReason;
            const order = await OrderService.cancelOrder(req.params.id, reason);
            if (!order) {
                res.status(404).json({ message: 'Order not found' });
                return;
            }
            res.json(order);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async checkCreating(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found in token.' });
                return;
            }

            const creatingOrderId = await OrderService.getCreatingOrderIdForStore(storeId);
            if (creatingOrderId) {
                res.json({ hasCreatingOrder: true, orderId: creatingOrderId });
            } else {
                res.json({ hasCreatingOrder: false });
            }
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while checking creating order.', error: error.message });
        }
    }

    static async getCookingOrders(req: Request, res: Response): Promise<void> {
        try {
            const orders = await OrderService.getCookingOrders();
            res.json(orders);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving kitchen orders.', error: error.message });
        }
    }

    static async startCooking(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.startCooking(req.params.orderId, req.user!.id);
            res.json({ message: 'Order has started cooking and ingredient history has been recorded.' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async finishCooking(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.orderId)) {
            res.status(400).json({ message: 'Invalid order ID.' });
            return;
        }
        try {
            await OrderService.finishCooking(req.params.orderId);
            res.json({ message: 'Order has finished cooking.' });
        } catch (error: any) {
            if (error instanceof OrderNotFoundError) {
                res.status(404).json({ message: error.message });
                return;
            }
            res.status(500).json({
                message: 'An error occurred while finishing cooking the order.',
                error: error.message
            });
        }
    }
}
