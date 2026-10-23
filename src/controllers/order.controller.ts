import { Request, Response } from 'express';
import { OrderHistoryAccessError, OrderInvalidStateError, OrderNotFoundError, OrderService } from '../services/order.service';

export class OrderController {
    static async getOrdersHistoryStore(req: Request, res: Response): Promise<void> {
        const isGuid = (value: unknown): value is string => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const queryField = (name: string) => {
            const key = Object.keys(req.query).find(key => key.toLowerCase() === name.toLowerCase());
            return key === undefined ? undefined : req.query[key];
        };
        const integer = (value: unknown, fallback: number): number => {
            if (value === undefined) return fallback;
            if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) return NaN;
            const number = Number(value);
            return number >= -2147483648 && number <= 2147483647 ? number : NaN;
        };
        const date = (value: unknown): Date | undefined => {
            if (value === undefined || value === '') return undefined;
            if (typeof value !== 'string') throw new Error('Invalid date.');
            // Preserve timezone-free SQL wall-clock values; explicit offsets are converted to UTC.
            const parsed = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}Z` : value);
            if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid date.');
            const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
            if (calendar) {
                const check = new Date(`${calendar[0]}T00:00:00Z`);
                if (check.getUTCFullYear() !== Number(calendar[1]) || check.getUTCMonth() + 1 !== Number(calendar[2])
                    || check.getUTCDate() !== Number(calendar[3])) throw new Error('Invalid date.');
            }
            return parsed;
        };
        const storeId = req.params.storeId;
        const pageNumber = integer(queryField('pageNumber'), 1);
        const pageSize = integer(queryField('pageSize'), 10);
        let fromDate: Date | undefined, toDate: Date | undefined;
        try { fromDate = date(queryField('fromDate')); toDate = date(queryField('toDate')); }
        catch { res.status(400).json({ message: 'Invalid date filter.' }); return; }
        if (!isGuid(storeId) || !Number.isFinite(pageNumber) || !Number.isFinite(pageSize)) {
            res.status(400).json({ message: 'Invalid store ID or pagination.' });
            return;
        }
        try {
            const userId = req.user?.id;
            if (!isGuid(userId)) {
                res.status(403).json({ message: 'User ID not found in token.' });
                return;
            }
            const { orders, totalRecords } = await OrderService.getOrdersHistoryAtStore(userId, storeId, pageNumber, pageSize, fromDate, toDate);
            res.json({
                status: 0,
                totalRecords,
                pageNumber,
                pageSize,
                data: orders,
                message: orders.length > 0 ? 'Get Orders history successfully' : 'No Orders history found'
            });
        } catch (error: any) {
            if (error instanceof OrderHistoryAccessError) {
                res.status(403).json({ message: error.message });
                return;
            }
            if (error instanceof OrderNotFoundError) {
                res.status(404).json({ message: error.message });
                return;
            }
            res.status(500).json('An internal error occurred.');
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
            if (!storeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
                res.status(401).json({ message: 'Store ID not found in token.' });
                return;
            }
            const orders = await OrderService.getOrdersByStore(storeId);
            res.json(orders);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving order IDs by store.', error: error.message });
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
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid order ID.' });
            return;
        }
        const body = req.body;
        const reasonKey = body && typeof body === 'object'
            ? Object.keys(body).find(key => key.toLowerCase() === 'cancellationreason') : undefined;
        const reason = reasonKey === undefined ? undefined : body[reasonKey];
        if (!body || typeof body !== 'object' || Array.isArray(body) || (reason != null && typeof reason !== 'string')) {
            res.status(400).json({ message: 'CancellationReason must be a string or null.' });
            return;
        }
        try {
            const order = await OrderService.cancelOrder(req.params.id, reason);
            if (!order) {
                res.status(404).json({ message: `Order with ID ${req.params.id} not found.` });
                return;
            }
            res.json(order);
        } catch (error: any) {
            if (error instanceof OrderInvalidStateError) {
                res.status(400).json({ message: error.message });
                return;
            }
            res.status(500).json({ message: 'An error occurred while cancelling the order.', error: error.message });
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
        const isGuid = (value: unknown): value is string => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (!isGuid(req.params.orderId)) {
            res.status(400).json({ message: 'Invalid order ID.' });
            return;
        }
        try {
            if (!req.user?.id) {
                res.status(401).json('User ID not found in token.');
                return;
            }
            if (!isGuid(req.user.id)) throw new Error('Unrecognized Guid format.');
            await OrderService.startCooking(req.params.orderId, req.user!.id);
            res.json({ message: 'Order has started cooking and ingredient history has been recorded.' });
        } catch (error: any) {
            if (error instanceof OrderNotFoundError) {
                res.status(404).json({ message: error.message });
                return;
            }
            if (error instanceof OrderInvalidStateError) {
                res.status(400).json({ message: error.message });
                return;
            }
            res.status(500).json({ message: 'An error occurred while starting to cook the order.', error: error.message });
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
