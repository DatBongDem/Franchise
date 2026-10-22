import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { StatusEnum } from '../constants/status.enum';

export class DeliveryController {
    static async getAvailableOrders(req: Request, res: Response): Promise<void> {
        try {
            const allOrders = await OrderService.getAllOrdersWithProductBatches();
            const availableOrders = allOrders.filter(o => o.Status !== StatusEnum.Creating);
            res.json(availableOrders);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving available orders.', error: error.message });
        }
    }

    static async pickUpOrder(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.pickUpOrder(req.params.orderId);
            res.json({ message: 'Order picked up successfully.' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async sendToKitchen(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.sendToKitchen(req.params.orderId);
            res.json({ message: 'Order sent to kitchen successfully.' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async takeFromKitchen(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.takeFromKitchen(req.params.orderId);
            res.json({ message: 'Order taken from kitchen successfully.' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async arriveAtStore(req: Request, res: Response): Promise<void> {
        try {
            await OrderService.arriveAtStore(req.params.orderId);
            res.json({ message: 'Order has arrived at the store successfully.' });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}
