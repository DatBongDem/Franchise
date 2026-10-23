import { Request, Response } from 'express';
import { BillingHistoryAccessError, BillingHistoryUserNotFoundError, BillingService, RevenueAccessError, RevenueInputError, RevenueUserNotFoundError } from '../services/billing.service';

export class BillsController {
    static async createBill(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const storeId = req.user?.idStore;

            if (!userId || !storeId) {
                res.status(401).json({ message: 'User ID or Store ID not found in token.' });
                return;
            }

            const { items, Items, note, Note } = req.body;
            const billItems = items || Items;

            if (!billItems || !Array.isArray(billItems) || billItems.length === 0) {
                res.status(400).json({ message: 'Bill must contain at least one item.' });
                return;
            }

            const formattedItems = billItems.map((i: any) => ({
                ProductId: i.productId || i.ProductId,
                Quantity: parseInt(i.quantity || i.Quantity, 10)
            }));

            const billId = await BillingService.createBill(
                userId,
                storeId,
                formattedItems,
                note || Note
            );

            res.json({ BillId: billId });
        } catch (error: any) {
            console.error('[BillsController.createBill] Error:', error.message);
            if (error.message.includes('Insufficient stock')) {
                res.status(422).json({ message: error.message });
            } else if (error.message.includes('not found')) {
                res.status(404).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
            }
        }
    }

    static async printBill(req: Request, res: Response): Promise<void> {
        try {
            const bill = await BillingService.getBillPrint(req.params.id);
            if (!bill) {
                res.status(404).json({ message: 'Bill not found' });
                return;
            }
            res.json(bill);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getBillingsHistoryStore(req: Request, res: Response): Promise<void> {
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

            const { listBills, totalRecords } = await BillingService.getBillingHistoryAtStore(
                userId,
                storeId,
                pageNumber,
                pageSize,
                fromDate,
                toDate
            );

            res.json({
                status: 0,
                totalRecords,
                pageNumber,
                pageSize,
                data: listBills,
                message: listBills.length > 0 ? 'Get bills history successfully' : 'No billing history found'
            });
        } catch (error: any) {
            if (error instanceof BillingHistoryAccessError) { res.status(403).json({ message: error.message }); return; }
            if (error instanceof BillingHistoryUserNotFoundError) { res.status(404).json({ message: error.message }); return; }
            res.status(500).json('An internal error occurred.');
        }
    }

    static async getStoreRevenue(req: Request, res: Response): Promise<void> {
        const isGuid = (value: unknown): value is string => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const queryField = (name: string) => {
            const key = Object.keys(req.query).find(key => key.toLowerCase() === name.toLowerCase());
            return key === undefined ? undefined : req.query[key];
        };
        const parseDate = (value: unknown): Date | undefined => {
            if (value === undefined || value === '') return undefined;
            if (typeof value !== 'string') throw new RevenueInputError('Invalid date filter.');
            const parsed = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}Z` : value);
            if (!Number.isFinite(parsed.getTime())) throw new RevenueInputError('Invalid date filter.');
            const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
            if (calendar) {
                const check = new Date(`${calendar[0]}T00:00:00Z`);
                if (check.getUTCFullYear() !== Number(calendar[1]) || check.getUTCMonth() + 1 !== Number(calendar[2])
                    || check.getUTCDate() !== Number(calendar[3])) throw new RevenueInputError('Invalid date filter.');
            }
            return parsed;
        };
        try {
            const storeId = req.params.storeId;
            if (!isGuid(storeId)) throw new RevenueInputError('Invalid store ID.');
            const date = parseDate(queryField('date'));
            const endDate = parseDate(queryField('endDate'));
            const userId = req.user?.id;
            if (!isGuid(userId)) {
                res.status(403).json({ message: 'User ID not found in token.' });
                return;
            }

            const result = await BillingService.getStoreRevenue(userId, storeId, date, endDate);
            res.json({
                status: 0,
                data: result,
                message: 'Get store revenue successfully'
            });
        } catch (error: any) {
            if (error instanceof RevenueInputError) { res.status(400).json({ message: error.message }); return; }
            if (error instanceof RevenueAccessError) { res.status(403).json({ message: error.message }); return; }
            if (error instanceof RevenueUserNotFoundError) { res.status(404).json({ message: error.message }); return; }
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getBillingHistory(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'User ID not found in token.' });
                return;
            }

            const pageNumber = parseInt(req.query.PageNumber as string || req.query.pageNumber as string || '1', 10);
            const pageSize = parseInt(req.query.PageSize as string || req.query.pageSize as string || '10', 10);

            const { listBills, totalRecords } = await BillingService.getBillingHistoryByStaff(userId, pageNumber, pageSize);
            res.json({
                TotalRecords: totalRecords,
                PageNumber: pageNumber,
                PageSize: pageSize,
                Data: listBills
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}
