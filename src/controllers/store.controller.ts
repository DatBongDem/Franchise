import { Request, Response } from 'express';
import { StoreService } from '../services/store.service';
import { OrderService } from '../services/order.service';

export class StoreController {
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const stores = await StoreService.getAll();
            res.json(stores);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const store = await StoreService.getById(req.params.id);
            if (!store) {
                res.status(404).json({ message: 'Store not found' });
                return;
            }
            res.json(store);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const { storeName, StoreName, address, Address } = req.body;
            const name = storeName || StoreName;
            if (!name) {
                res.status(400).json({ message: 'StoreName is required.' });
                return;
            }

            const store = await StoreService.create({
                StoreName: name,
                Address: address || Address
            });
            await OrderService.createOrder({ Type: 'Normal', Note: '' }, store.StoreId);
            res.status(200).json('Create store and initial order successfully');
        } catch (error: any) {
            res.status(400).json(error.message);
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const { storeName, StoreName, address, Address } = req.body;
            const success = await StoreService.update(req.params.id, {
                StoreName: storeName || StoreName,
                Address: address || Address
            });
            if (!success) {
                res.status(404).json({ message: 'Store not found' });
                return;
            }
            res.json({ message: 'Store updated successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await StoreService.delete(req.params.id);
            if (!success) {
                res.status(404).json({ message: 'Store not found' });
                return;
            }
            res.json({ message: 'Store deleted successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }
}
