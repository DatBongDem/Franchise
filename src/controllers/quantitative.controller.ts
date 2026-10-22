import { Request, Response } from 'express';
import { QuantitativeService } from '../services/quantitative.service';

export class QuantitativeController {
    static async getQuantitativesForStore(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.user?.idStore;
            if (!storeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
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
        const isGuid = (value: unknown): value is string => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (!isGuid(req.params.productId)) {
            res.status(400).json({ message: 'Invalid product ID.' });
            return;
        }
        const rawQuantity = req.body?.quantity ?? req.body?.Quantity;
        // ASP.NET's web JSON defaults also allow integer values quoted as strings.
        const qty = typeof rawQuantity === 'number' ? rawQuantity
            : typeof rawQuantity === 'string' && /^-?\d+$/.test(rawQuantity) ? Number(rawQuantity) : NaN;
        if (!Number.isInteger(qty) || qty < 1 || qty > 2147483647) {
            res.status(400).json({ message: 'Quantity must be a positive number.' });
            return;
        }
        try {
            const storeId = req.user?.idStore;
            if (!isGuid(storeId)) {
                res.status(401).json({ message: 'Store ID not found or invalid in token.' });
                return;
            }

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
