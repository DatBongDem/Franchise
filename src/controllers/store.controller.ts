import { Request, Response } from 'express';
import { StoreService } from '../services/store.service';
import { OrderService } from '../services/order.service';

export class StoreController {
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const stores = await StoreService.getAll();
            res.json(stores.map(store => ({
                storeId: store.StoreId,
                storeName: store.StoreName,
                address: store.Address,
                status: store.Status
            })));
        } catch (error: any) {
            res.status(400).json(error.message);
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid store ID.' });
            return;
        }
        try {
            const store = await StoreService.getById(req.params.id);
            if (!store) {
                res.status(400).json('Store not found');
                return;
            }
            res.json({
                storeId: store.StoreId,
                storeName: store.StoreName,
                address: store.Address,
                status: store.Status
            });
        } catch (error: any) {
            res.status(400).json(error.message);
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
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid store ID.' });
            return;
        }
        const body = req.body;
        const name = body?.storeName !== undefined ? body.storeName : body?.StoreName;
        const address = body?.address !== undefined ? body.address : body?.Address;
        if (!body || Array.isArray(body) || typeof name !== 'string'
            || (address != null && typeof address !== 'string')) {
            res.status(400).json({ message: 'StoreName must be a string and Address must be a string or null.' });
            return;
        }
        try {
            const success = await StoreService.update(req.params.id, {
                StoreName: name,
                Address: address ?? null
            });
            if (!success) {
                res.status(400).json('Store not found');
                return;
            }
            res.json('Update store successfully');
        } catch (error: any) {
            res.status(400).json(error.message);
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid store ID.' });
            return;
        }
        try {
            const success = await StoreService.delete(req.params.id);
            if (!success) {
                res.status(400).json(`Not found Store with Id: ${req.params.id}`);
                return;
            }
            res.json('Delete store successfully');
        } catch (error: any) {
            res.status(400).json(error.message);
        }
    }
}
