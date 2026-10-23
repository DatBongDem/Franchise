import type { RecipeDto } from '../services/recipe.service';

export function parseRecipeInput(body: any): RecipeDto {
    const field = (value: any, name: string): any => value && typeof value === 'object'
        ? value[Object.keys(value).find(key => key.toLowerCase() === name.toLowerCase()) ?? name] : undefined;
    const guid = (value: any): string | null => {
        if (value === undefined) return '00000000-0000-0000-0000-000000000000';
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
            ? value.toLowerCase() : null;
    };
    const productId = guid(field(body, 'productId'));
    const description = field(body, 'description');
    const rawIngredients = field(body, 'ingredients');
    const ingredients = rawIngredients === undefined ? [] : rawIngredients;
    if (!body || Array.isArray(body) || !productId || typeof description !== 'string' || !Array.isArray(ingredients)) {
        throw new Error('Invalid recipe data.');
    }
    const normalizedIngredients = [];
    for (const item of ingredients) {
        const ingredientID = guid(field(item, 'ingredientID'));
        const rawQuantity = field(item, 'quantity');
        const quantity = rawQuantity === undefined ? 0 : typeof rawQuantity === 'number' ? rawQuantity
            : typeof rawQuantity === 'string' && /^[+-]?(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(rawQuantity)
                ? Number(rawQuantity) : NaN;
        if (!item || typeof item !== 'object' || Array.isArray(item) || !ingredientID
            || !Number.isFinite(quantity) || Math.abs(quantity) > 7.922816251426433e28) {
            throw new Error('Invalid recipe ingredient data.');
        }
        normalizedIngredients.push({ IngredientID: ingredientID, Quantity: quantity });
    }
    return { ProductId: productId, Description: description, Ingredients: normalizedIngredients };
}
