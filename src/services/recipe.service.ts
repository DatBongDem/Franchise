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
    static async getRecipeById(id: string): Promise<any | null> {
        const recipe = await queryOne(
            'SELECT RecipeID, ProductID, Description FROM Recipes WHERE RecipeID = @id', { id }
        );
        if (!recipe) return null;
        return {
            recipeID: recipe.RecipeID,
            productID: recipe.ProductID,
            description: recipe.Description,
            // C# GetByIdAsync does not Include the navigation collection.
            recipeIngredients: []
        };
    }

    // The read endpoint uses RecipeResponseDto.
    static async getDetailsById(id: string): Promise<any | null> {
        const recipe = await queryOne('SELECT RecipeID, Description FROM Recipes WHERE RecipeID = @id', { id });
        if (!recipe) return null;
        const ingredients = await query(
            'SELECT IngredientId, Quantity FROM RecipeIngredients WHERE RecipeId = @id', { id }
        );
        return {
            recipeID: recipe.RecipeID,
            description: recipe.Description,
            ingredients: ingredients.map(item => ({ ingredientID: item.IngredientId, quantity: item.Quantity }))
        };
    }

    static async getAll(): Promise<any[]> {
        const recipes = await query('SELECT RecipeID, ProductID, Description FROM Recipes');
        return recipes.map(recipe => ({
            recipeID: recipe.RecipeID,
            productID: recipe.ProductID,
            description: recipe.Description,
            // GetAllAsync does not Include the C# navigation collection.
            recipeIngredients: []
        }));
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

        const ingredientIds = dto.Ingredients.map(item => item.IngredientID.toLowerCase());
        if (new Set(ingredientIds).size !== ingredientIds.length) {
            throw new Error('Duplicate ingredient detected');
        }
        // Match C#: validate every ingredient before inserting the recipe or its details.
        for (const item of dto.Ingredients) {
            const ingredient = await queryOne('SELECT IngredientId FROM Ingredients WHERE IngredientId = @id', {
                id: item.IngredientID
            });
            if (!ingredient) throw new Error(`Ingredient with ID ${item.IngredientID} not found`);
        }

        const recipeId = uuidv4();
        await execute(
            `INSERT INTO Recipes (RecipeID, ProductID, Description)
             VALUES (@recipeId, @productId, @description)`,
            {
                recipeId,
                productId: dto.ProductId,
                description: dto.Description
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

        return { RecipeID: recipeId };
    }

    static async update(id: string, dto: RecipeDto): Promise<boolean> {
        const recipe = await this.getById(id);
        if (!recipe) return false;

        // RemoveRangeAsync's first SaveChanges persists description and removals together.
        await execute(
            `BEGIN TRY
                 BEGIN TRANSACTION;
                 UPDATE Recipes SET Description = @desc WHERE RecipeID = @id;
                 DELETE FROM RecipeIngredients WHERE RecipeId = @id;
                 COMMIT TRANSACTION;
             END TRY
             BEGIN CATCH
                 IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
                 THROW;
             END CATCH`,
            { id, desc: dto.Description }
        );
        if (dto.Ingredients && dto.Ingredients.length > 0) {
            // C# saves the entire replacement collection together, after removing old items.
            await execute(
                `INSERT INTO RecipeIngredients (RecipeId, IngredientId, Quantity)
                 SELECT @recipeId, ingredientId, quantity
                 FROM OPENJSON(@ingredients) WITH (ingredientId uniqueidentifier, quantity decimal(18,2))`,
                { recipeId: id, ingredients: JSON.stringify(dto.Ingredients.map(item => ({
                    ingredientId: item.IngredientID, quantity: item.Quantity
                }))) }
            );
        }

        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Recipes WHERE RecipeID = @id', { id });
        if (!(result.rowsAffected[0] > 0)) throw new Error(`Not found Recipe with Id: ${id}`);
        return true;
    }
}
