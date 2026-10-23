const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('recipe ingredient read matches C# DTO, decimals, empty/null results and public access', async () => {
    const originals = { queryOne: db.queryOne, query: db.query };
    const id = '00000000-0000-0000-0000-000000000001';
    let recipe = { RecipeID: id, Description: 'Mix ingredients' };
    let ingredients = [{ IngredientId: 'ingredient-a', Quantity: 1.25 }, { IngredientId: 'ingredient-b', Quantity: 0.005 }];
    let failure = '';
    const calls = [];
    db.queryOne = async (sql, params) => {
        calls.push('recipe');
        assert.deepEqual(params, { id });
        assert.match(sql, /FROM Recipes WHERE RecipeID = @id/);
        if (failure === 'recipe') throw new Error('Read failed');
        return recipe;
    };
    db.query = async (sql, params) => {
        calls.push('ingredients');
        assert.deepEqual(params, { id });
        assert.match(sql, /FROM RecipeIngredients WHERE RecipeId = @id/);
        assert.doesNotMatch(sql, /JOIN Products|JOIN Ingredients|isDeleted/i);
        if (failure === 'ingredients') throw new Error('Read failed');
        return ingredients;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (recipeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/recipe/${recipeId}/with-ingredients`);
    try {
        assert.equal((await send('invalid')).status, 400);
        assert.equal(calls.length, 0);
        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), {
            recipeID: id, description: 'Mix ingredients',
            ingredients: [{ ingredientID: 'ingredient-a', quantity: 1.25 }, { ingredientID: 'ingredient-b', quantity: 0.005 }]
        });
        assert.deepEqual(calls, ['recipe', 'ingredients']);
        ingredients = [];
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), { recipeID: id, description: 'Mix ingredients', ingredients: [] });
        recipe = null;
        calls.length = 0;
        const missing = await send();
        assert.equal(missing.status, 204);
        assert.equal(await missing.text(), '');
        assert.deepEqual(calls, ['recipe']);
        recipe = { RecipeID: id, Description: 'Mix ingredients' };
        for (const stage of ['recipe', 'ingredients']) {
            failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.query = originals.query;
        await new Promise(resolve => server.close(resolve));
    }
});
