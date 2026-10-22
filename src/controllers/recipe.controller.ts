import { Request, Response } from 'express';
import { RecipeService } from '../services/recipe.service';

export class RecipeController {
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const list = await RecipeService.getAll();
            res.json(list);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const recipe = await RecipeService.getById(req.params.id);
            if (!recipe) {
                res.status(404).json({ message: 'Recipe not found' });
                return;
            }
            res.json(recipe);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getWithIngredientsById(req: Request, res: Response): Promise<void> {
        try {
            const recipe = await RecipeService.getWithIngredientsById(req.params.id);
            if (!recipe) {
                res.status(404).json({ message: 'Recipe not found' });
                return;
            }
            res.json(recipe);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const recipe = await RecipeService.create(req.body);
            res.status(201).json(recipe);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const success = await RecipeService.update(req.params.id, req.body);
            if (!success) {
                res.status(404).json({ message: 'Recipe not found' });
                return;
            }
            res.json('Recipe updated successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await RecipeService.delete(req.params.id);
            if (!success) {
                res.status(404).json({ message: 'Recipe not found' });
                return;
            }
            res.json('Recipe deleted successfully');
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }
}
