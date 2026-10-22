import { Request, Response } from 'express';
import { QuantitativeService } from '../services/quantitative.service';

export class QuantitativeController {
    static async getQuantitativesForStore(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.query.storeId as string || req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found or invalid in token.' });
                return;
            }

            const result = await QuantitativeService.getByStoreId(storeId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ message: 'An unexpected error occurred.', details: error.message });
        }
    }

    static async updateQuantitative(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.body.storeId || req.query.storeId as string || req.user?.idStore;
            if (!storeId) {
                res.status(401).json({ message: 'Store ID not found or invalid in token.' });
                return;
            }

            const { quantity, Quantity } = req.body;
            const qty = parseInt(quantity ?? Quantity ?? 0, 10);

            const success = await QuantitativeService.update(storeId, req.params.productId, qty);
            if (!success) {
                res.status(404).json({ message: 'Quantitative rule not found for the specified product and store.' });
                return;
            }

            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ message: 'An unexpected error occurred.', details: error.message });
        }
    }
}
