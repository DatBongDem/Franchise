const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('recipe creation matches C# validation order, writes, DTO response and Location', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const productId = '00000000-0000-0000-0000-000000000001';
    const ingredientA = 'aaaaaaaa-0000-0000-0000-000000000001';
    const ingredientB = 'bbbbbbbb-0000-0000-0000-000000000002';
    const valid = { productId, description: 'Mix', ingredients: [
        { ingredientID: ingredientA, quantity: 1.25 }, { ingredientID: ingredientB, quantity: 0.005 }
    ] };
    let duplicateRecipe = false, missingIngredient = '', failure = '';
    const calls = [];
    db.queryOne = async (sql, params) => {
        const kind = sql.includes('FROM Recipes') ? 'recipe-read' : 'ingredient-read';
        calls.push({ kind, params });
        if (failure === kind) throw new Error('Read failed');
        if (kind === 'recipe-read') return duplicateRecipe ? { RecipeID: 'existing' } : null;
        assert.match(sql, /FROM Ingredients WHERE IngredientId = @id/);
        return params.id === missingIngredient ? null : { IngredientId: params.id };
    };
    db.execute = async (sql, params) => {
        const kind = sql.includes('INSERT INTO Recipes ') ? 'recipe-write' : 'ingredient-write';
        calls.push({ kind, sql, params });
        if (failure === kind) throw new Error('Write failed');
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = body => fetch(`http://127.0.0.1:${server.address().port}/api/recipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const businessError = async (body, message) => {
        calls.length = 0;
        const response = await send(body);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { message });
        assert.equal(calls.some(call => call.kind.endsWith('write')), false);
    };
    try {
        for (const body of [{}, [], { ...valid, productId: 'invalid' }, { ...valid, description: null },
            { ...valid, ingredients: null }, { ...valid, ingredients: {} },
            { ...valid, ingredients: [null] }, { ...valid, ingredients: [{ ingredientID: 'invalid', quantity: 1 }] },
            { ...valid, ingredients: [{ ingredientID: ingredientA, quantity: '2abc' }] },
            { ...valid, ingredients: [{ ingredientID: ingredientA, quantity: true }] }]) {
            assert.equal((await send(body)).status, 400);
        }
        assert.equal(calls.length, 0);
        duplicateRecipe = true;
        await businessError({ ...valid, ingredients: [] }, 'Sản phẩm này đã có công thức.');
        assert.deepEqual(calls.map(call => call.kind), ['recipe-read']);
        duplicateRecipe = false;
        await businessError({ productId, description: '' }, 'Recipe must have at least one ingredient');
        await businessError({ ...valid, ingredients: [] }, 'Recipe must have at least one ingredient');
        await businessError({ ...valid, ingredients: [valid.ingredients[0], { ingredientID: ingredientA.toUpperCase(), quantity: 2 }] }, 'Duplicate ingredient detected');
        assert.deepEqual(calls.map(call => call.kind), ['recipe-read']);
        missingIngredient = ingredientB;
        await businessError(valid, `Ingredient with ID ${ingredientB} not found`);
        assert.deepEqual(calls.map(call => call.kind), ['recipe-read', 'ingredient-read', 'ingredient-read']);
        missingIngredient = '';

        calls.length = 0;
        const created = await send(valid);
        assert.equal(created.status, 201);
        assert.deepEqual(await created.json(), valid);
        assert.deepEqual(calls.map(call => call.kind), [
            'recipe-read', 'ingredient-read', 'ingredient-read', 'recipe-write', 'ingredient-write', 'ingredient-write'
        ]);
        const recipeId = calls[3].params.recipeId;
        assert.match(recipeId, /^[0-9a-f-]{36}$/);
        assert.equal(created.headers.get('location'), `/api/recipe/${recipeId}`);
        assert.deepEqual(calls[3].params, { recipeId, productId, description: 'Mix' });
        assert.deepEqual(calls[4].params, { recipeId, ingredientId: ingredientA, quantity: 1.25 });
        assert.deepEqual(calls[5].params, { recipeId, ingredientId: ingredientB, quantity: 0.005 });

        // Preserve C# DTO casing support, decimal strings, default quantity and no positivity range.
        const pascal = await send({ ProductId: productId.toUpperCase(), Description: '', Ingredients: [
            { IngredientID: ingredientA.toUpperCase(), Quantity: '-2.5' }, { IngredientID: ingredientB }
        ] });
        assert.equal(pascal.status, 201);
        assert.deepEqual(await pascal.json(), { productId, description: '', ingredients: [
            { ingredientID: ingredientA, quantity: -2.5 }, { ingredientID: ingredientB, quantity: 0 }
        ] });
        for (const stage of ['recipe-read', 'ingredient-read', 'recipe-write', 'ingredient-write']) {
            failure = stage;
            const failed = await send(valid);
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: stage.endsWith('read') ? 'Read failed' : 'Write failed' });
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
