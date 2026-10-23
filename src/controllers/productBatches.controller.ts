import { Request, Response } from 'express';
import { ProductBatchService, ShrinkageAccessError, ShrinkageUserNotFoundError } from '../services/productBatch.service';
import { WarehouseService } from '../services/warehouse.service';

export class ProductBatchesController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found in token.' });
                return;
            }

            const { productId, ProductId, qualityOrder, QualityOrder } = req.body;
            const prodId = productId || ProductId;
            const qty = parseInt(qualityOrder ?? QualityOrder ?? 0, 10);

            const result = await ProductBatchService.createProductBatch(
                { ProductId: prodId, QualityOrder: qty },
                storeId
            );

            res.status(201).json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found in token.' });
                return;
            }

            const { qualityOrder, QualityOrder } = req.body;
            const qty = parseInt(qualityOrder ?? QualityOrder ?? 0, 10);

            const result = await ProductBatchService.updateProductBatchInCreatingOrder(
                req.params.productId,
                qty,
                storeId
            );

            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async getStoreShrinkage(req: Request, res: Response): Promise<void> {
        const isGuid = (value: unknown): value is string => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (!isGuid(req.params.storeId)) {
            res.status(400).json({ message: 'Invalid store ID.' });
            return;
        }
        try {
            if (!isGuid(req.user?.id)) {
                res.status(403).json({ message: 'User ID not found in token.' });
                return;
            }
            const result = await ProductBatchService.getStoreShrinkage(req.user.id, req.params.storeId);
            res.json({
                status: 0,
                data: result,
                message: result.items.length > 0 ? 'Get store shrinkage successfully' : 'No expired products found'
            });
        } catch (error: any) {
            if (error instanceof ShrinkageAccessError) { res.status(403).json({ message: error.message }); return; }
            if (error instanceof ShrinkageUserNotFoundError) { res.status(404).json({ message: error.message }); return; }
            res.status(500).json('An internal error occurred.');
        }
    }

    static async getStoreInventory(req: Request, res: Response): Promise<void> {
        try {
            const inventory = await WarehouseService.getStoreInventory(req.params.storeId);
            res.json(inventory);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving store inventory.', error: error.message });
        }
    }

    static async getAllProductsInventory(req: Request, res: Response): Promise<void> {
        try {
            const inventory = await WarehouseService.getAllProductsInventory();
            res.json(inventory);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving all products inventory.', error: error.message });
        }
    }

    static async getExpiredInventorySummary(req: Request, res: Response): Promise<void> {
        try {
            const expired = await WarehouseService.getExpiredInventorySummary();
            res.json(expired);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving expired inventory summary.', error: error.message });
        }
    }

    static async getExpiredInventoryByDate(req: Request, res: Response): Promise<void> {
        try {
            const date = new Date(req.params.date);
            const expired = await WarehouseService.getExpiredInventoryByDate(date);
            res.json(expired);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving expired inventory for date.', error: error.message });
        }
    }

    static async getProductBatchesByProductId(req: Request, res: Response): Promise<void> {
        try {
            const batches = await WarehouseService.getProductBatchesByProductId(req.params.productId);
            if (!batches || batches.length === 0) {
                res.status(404).json({ message: `No batches found for product ID ${req.params.productId}.` });
                return;
            }
            res.json(batches);
        } catch (error: any) {
            res.status(500).json({ message: 'An error occurred while retrieving batches.', error: error.message });
        }
    }
}
