import { Request, Response } from 'express';
import { IngredientHistoryOrderNotFoundError, IngredientService } from '../services/ingredient.service';

export class IngredientController {
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const list = await IngredientService.getAll();
            res.json(list);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const item = await IngredientService.getById(req.params.id);
            if (!item) {
                res.status(404).json({ message: 'Ingredient not found' });
                return;
            }
            res.json(item);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const { ingredientName, IngredientName, unit, Unit, status, Status } = req.body;
            const name = ingredientName || IngredientName;
            const u = unit || Unit;

            if (!name || !u) {
                res.status(400).json({ message: 'IngredientName and Unit are required.' });
                return;
            }

            const item = await IngredientService.create({
                IngredientName: name,
                Unit: u,
                Status: status || Status
            });
            res.status(201).json(item);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            // The C# route uses {id:guid}, so invalid IDs do not match it.
            res.status(404).send();
            return;
        }
        const body = req.body;
        const name = body?.ingredientName ?? body?.IngredientName;
        const unit = body?.unit ?? body?.Unit;
        if (!body || Array.isArray(body) || typeof name !== 'string' || typeof unit !== 'string') {
            res.status(400).json({ message: 'IngredientName and Unit must be provided as strings.' });
            return;
        }
        try {
            const success = await IngredientService.update(req.params.id, {
                IngredientName: name,
                Unit: unit
            });
            if (!success) {
                res.status(404).send();
                return;
            }
            res.json('Ingredient updated successfully');
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await IngredientService.delete(req.params.id);
            if (!success) {
                res.status(404).json({ message: 'Ingredient not found' });
                return;
            }
            res.json('Ingredient deleted successfully');
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getIngredientHistory(req: Request, res: Response): Promise<void> {
        const integerQuery = (name: string, fallback: number): number => {
            const key = Object.keys(req.query).find(key => key.toLowerCase() === name.toLowerCase());
            if (key === undefined) return fallback;
            const raw = req.query[key];
            if (typeof raw !== 'string' || !/^[+-]?\d+$/.test(raw)) return NaN;
            const value = Number(raw);
            return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 ? value : NaN;
        };
        const pageNumber = integerQuery('pageNumber', 1);
        const pageSize = integerQuery('pageSize', 10);
        if (!Number.isFinite(pageNumber) || !Number.isFinite(pageSize)) {
            res.status(400).json({ message: 'pageNumber and pageSize must be valid integers.' });
            return;
        }
        try {
            const result = await IngredientService.getAllCookingIngredientHistories(pageNumber, pageSize);

            res.json({
                status: 0,
                data: result,
                message: result.items.length > 0
                    ? 'Get all cooking ingredient histories successfully.'
                    : 'No cooking ingredient histories found.'
            });
        } catch (error: any) {
            res.status(500).json({ message: 'An internal error occurred.', error: error.message });
        }
    }

    static async getCookingIngredients(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.orderId)) {
            res.status(400).json({ message: 'Invalid order ID.' });
            return;
        }
        try {
            const result = await IngredientService.getCookingIngredientsByOrder(req.params.orderId);
            res.json(result);
        } catch (error: any) {
            if (error instanceof IngredientHistoryOrderNotFoundError) {
                res.status(404).json({ message: error.message });
                return;
            }
            res.status(500).json({
                message: 'An error occurred while retrieving cooking ingredient history.',
                error: error.message
            });
        }
    }
}
