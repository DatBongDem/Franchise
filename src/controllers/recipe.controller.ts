import { Request, Response } from 'express';
import { RecipeService } from '../services/recipe.service';
import { parseRecipeInput } from '../utils/recipe-input';

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
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid recipe ID.' });
            return;
        }
        try {
            const recipe = await RecipeService.getRecipeById(req.params.id);
            if (!recipe) {
                res.status(204).send();
                return;
            }
            res.json(recipe);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getWithIngredientsById(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid recipe ID.' });
            return;
        }
        try {
            const recipe = await RecipeService.getDetailsById(req.params.id);
            if (!recipe) {
                // ASP.NET Core's default output formatter turns Ok(null) into 204.
                res.status(204).send();
                return;
            }
            res.json(recipe);
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        // ASP.NET binds DTO properties case-insensitively and defaults value types.
        const field = (value: any, name: string): any => value && typeof value === 'object'
            ? value[Object.keys(value).find(key => key.toLowerCase() === name.toLowerCase()) ?? name] : undefined;
        const guid = (value: any): string | null => {
            if (value === undefined) return '00000000-0000-0000-0000-000000000000';
            return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
                ? value.toLowerCase() : null;
        };
        const body = req.body;
        const productId = guid(field(body, 'productId'));
        const description = field(body, 'description');
        const rawIngredients = field(body, 'ingredients');
        const ingredients = rawIngredients === undefined ? [] : rawIngredients;
        if (!body || Array.isArray(body) || !productId || typeof description !== 'string' || !Array.isArray(ingredients)) {
            res.status(400).json({ message: 'Invalid recipe data.' });
            return;
        }
        const normalizedIngredients = [];
        for (const item of ingredients) {
            const ingredientID = guid(field(item, 'ingredientID'));
            const rawQuantity = field(item, 'quantity');
            const quantity = rawQuantity === undefined ? 0 : typeof rawQuantity === 'number' ? rawQuantity
                : typeof rawQuantity === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rawQuantity)
                    ? Number(rawQuantity) : NaN;
            if (!item || typeof item !== 'object' || Array.isArray(item) || !ingredientID
                || !Number.isFinite(quantity) || Math.abs(quantity) > 7.922816251426433e28) {
                res.status(400).json({ message: 'Invalid recipe ingredient data.' });
                return;
            }
            normalizedIngredients.push({ IngredientID: ingredientID, Quantity: quantity });
        }
        try {
            const recipe = await RecipeService.create({ ProductId: productId, Description: description, Ingredients: normalizedIngredients });
            res.location(`${req.baseUrl}/${recipe.RecipeID}`).status(201).json({
                productId,
                description,
                ingredients: normalizedIngredients.map(item => ({ ingredientID: item.IngredientID, quantity: item.Quantity }))
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
            res.status(400).json({ message: 'Invalid recipe ID.' });
            return;
        }
        let dto;
        try { dto = parseRecipeInput(req.body); }
        catch (error: any) { res.status(400).json({ message: error.message }); return; }
        try {
            const success = await RecipeService.update(req.params.id, dto);
            if (!success) {
                res.status(404).send();
                return;
            }
            res.json('Recipe updated successfully');
        } catch (error: any) {
            res.status(500).json({ message: error.message });
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
