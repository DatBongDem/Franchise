import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';

export interface RecipeIngredientDto {
    IngredientID: string;
    Quantity: number;
    IngredientName?: string;
    Unit?: string;
}

export interface RecipeDto {
    RecipeID?: string;
    ProductId: string;
    Description: string;
    Ingredients: RecipeIngredientDto[];
}

export class RecipeService {
    static async getAll(): Promise<any[]> {
        return await query(
            `SELECT r.*, p.ProductName
             FROM Recipes r
             LEFT JOIN Products p ON r.ProductID = p.ProductId`
        );
    }

    static async getById(id: string): Promise<any | null> {
        return await queryOne(
            `SELECT r.*, p.ProductName
             FROM Recipes r
             LEFT JOIN Products p ON r.ProductID = p.ProductId
             WHERE r.RecipeID = @id`,
            { id }
        );
    }

    static async getWithIngredientsById(id: string): Promise<any | null> {
        const recipe = await this.getById(id);
        if (!recipe) return null;

        const ingredients = await query(
            `SELECT ri.IngredientId, ri.Quantity, i.IngredientName, i.Unit
             FROM RecipeIngredients ri
             JOIN Ingredients i ON ri.IngredientId = i.IngredientId
             WHERE ri.RecipeId = @id`,
            { id }
        );

        return {
            RecipeID: recipe.RecipeID,
            ProductID: recipe.ProductID,
            ProductName: recipe.ProductName,
            Description: recipe.Description,
            Ingredients: ingredients.map(i => ({
                IngredientID: i.IngredientId,
                IngredientName: i.IngredientName,
                Unit: i.Unit,
                Quantity: i.Quantity
            }))
        };
    }

    static async create(dto: RecipeDto): Promise<any> {
        const existing = await queryOne('SELECT * FROM Recipes WHERE ProductID = @productId', {
            productId: dto.ProductId
        });
        if (existing) {
            throw new Error('Sản phẩm này đã có công thức.');
        }

        if (!dto.Ingredients || dto.Ingredients.length === 0) {
            throw new Error('Recipe must have at least one ingredient');
        }

        const recipeId = uuidv4();
        await execute(
            `INSERT INTO Recipes (RecipeID, ProductID, Description)
             VALUES (@recipeId, @productId, @description)`,
            {
                recipeId,
                productId: dto.ProductId,
                description: dto.Description || ''
            }
        );

        for (const item of dto.Ingredients) {
            await execute(
                `INSERT INTO RecipeIngredients (RecipeId, IngredientId, Quantity)
                 VALUES (@recipeId, @ingredientId, @quantity)`,
                {
                    recipeId,
                    ingredientId: item.IngredientID,
                    quantity: item.Quantity
                }
            );
        }

        return await this.getWithIngredientsById(recipeId);
    }

    static async update(id: string, dto: RecipeDto): Promise<boolean> {
        const recipe = await this.getById(id);
        if (!recipe) return false;

        await execute('UPDATE Recipes SET Description = @desc WHERE RecipeID = @id', {
            id,
            desc: dto.Description || ''
        });

        // Replace ingredients
        await execute('DELETE FROM RecipeIngredients WHERE RecipeId = @id', { id });
        if (dto.Ingredients && dto.Ingredients.length > 0) {
            for (const item of dto.Ingredients) {
                await execute(
                    `INSERT INTO RecipeIngredients (RecipeId, IngredientId, Quantity)
                     VALUES (@recipeId, @ingredientId, @quantity)`,
                    {
                        recipeId: id,
                        ingredientId: item.IngredientID,
                        quantity: item.Quantity
                    }
                );
            }
        }

        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Recipes WHERE RecipeID = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }
}
