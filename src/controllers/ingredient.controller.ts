import { Request, Response } from 'express';
import { IngredientService } from '../services/ingredient.service';

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
        try {
            const { ingredientName, IngredientName, unit, Unit, status, Status } = req.body;
            const success = await IngredientService.update(req.params.id, {
                IngredientName: ingredientName || IngredientName,
                Unit: unit || Unit,
                Status: status || Status
            });
            if (!success) {
                res.status(404).json({ message: 'Ingredient not found' });
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
        try {
            const pageNumber = parseInt(req.query.pageNumber as string || '1', 10);
            const pageSize = parseInt(req.query.pageSize as string || '10', 10);
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
        try {
            const result = await IngredientService.getCookingIngredientsByOrder(req.params.orderId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                message: 'An error occurred while retrieving cooking ingredient history.',
                error: error.message
            });
        }
    }
}
