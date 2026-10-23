const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('recipe update matches C# DTO binding, replacement semantics, separate saves and errors', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const id = '00000000-0000-0000-0000-000000000001';
    const productId = '00000000-0000-0000-0000-000000000002';
    const ingredientA = 'aaaaaaaa-0000-0000-0000-000000000003';
    const ingredientB = 'bbbbbbbb-0000-0000-0000-000000000004';
    let recipe, storedIngredients, failure;
    const calls = [];
    const reset = () => {
        recipe = { RecipeID: id, ProductID: productId, Description: 'Old description' };
        storedIngredients = [{ ingredientId: 'old', quantity: 9 }];
        failure = ''; calls.length = 0;
    };
    db.queryOne = async (sql, params) => {
        calls.push({ kind: 'read', params });
        assert.deepEqual(params, { id });
        if (failure === 'read') throw new Error('Read failed');
        return recipe;
    };
    db.execute = async (sql, params) => {
        const kind = sql.includes('UPDATE Recipes') ? 'save-removals' : 'save-replacements';
        calls.push({ kind, sql, params });
        if (failure === kind) throw new Error('Save failed');
        if (kind === 'save-removals') {
            assert.match(sql, /BEGIN TRANSACTION/);
            assert.match(sql, /UPDATE Recipes SET Description = @desc WHERE RecipeID = @id/);
            assert.match(sql, /DELETE FROM RecipeIngredients WHERE RecipeId = @id/);
            assert.match(sql, /COMMIT TRANSACTION/);
            assert.match(sql, /ROLLBACK TRANSACTION/);
            assert.doesNotMatch(sql, /ProductID\s*=/i);
            recipe.Description = params.desc;
            storedIngredients = [];
        } else {
            assert.match(sql, /INSERT INTO RecipeIngredients/);
            assert.match(sql, /FROM OPENJSON\(@ingredients\)/);
            assert.equal(params.recipeId, id);
            const items = JSON.parse(params.ingredients);
            if (new Set(items.map(i => i.ingredientId)).size !== items.length) throw new Error('Duplicate key');
            if (items.some(i => i.ingredientId === '00000000-0000-0000-0000-000000000000')) throw new Error('Foreign key violation');
            storedIngredients = items;
        }
        return { rowsAffected: [1] };
    };
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (body, recipeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/recipe/${recipeId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    try {
        reset();
        assert.equal((await send({ description: 'New' }, 'invalid')).status, 400);
        for (const body of [{}, [], { description: null }, { description: 'New', productId: 'invalid' },
            { description: 'New', ingredients: null }, { description: 'New', ingredients: [null] },
            { description: 'New', ingredients: [{ ingredientID: 'invalid', quantity: 1 }] },
            { description: 'New', ingredients: [{ ingredientID: ingredientA, quantity: '2bad' }] }]) {
            assert.equal((await send(body)).status, 400);
        }
        assert.equal(calls.length, 0);
        const success = await send({ productId: id, description: 'Updated', ingredients: [
            { ingredientID: ingredientA, quantity: 1.25 }, { ingredientID: ingredientB, quantity: 0.5 }
        ] });
        assert.equal(success.status, 200);
        assert.equal(await success.json(), 'Recipe updated successfully');
        assert.equal(recipe.ProductID, productId);
        assert.equal(recipe.Description, 'Updated');
        assert.deepEqual(storedIngredients, [{ ingredientId: ingredientA, quantity: 1.25 }, { ingredientId: ingredientB, quantity: 0.5 }]);
        assert.deepEqual(calls.map(c => c.kind), ['read', 'save-removals', 'save-replacements']);
        reset();
        const pascal = await send({ Description: '', Ingredients: [
            { IngredientID: ingredientA.toUpperCase(), Quantity: '-2.5' }, { IngredientID: ingredientB }
        ] });
        assert.equal(pascal.status, 200);
        assert.equal(recipe.Description, '');
        assert.deepEqual(storedIngredients, [{ ingredientId: ingredientA, quantity: -2.5 }, { ingredientId: ingredientB, quantity: 0 }]);
        for (const body of [{ description: 'Cleared', ingredients: [] }, { description: 'Cleared' }]) {
            reset();
            assert.equal((await send(body)).status, 200);
            assert.deepEqual(storedIngredients, []);
            assert.deepEqual(calls.map(c => c.kind), ['read', 'save-removals']);
        }
        reset(); recipe = null;
        const missing = await send({ description: 'New' });
        assert.equal(missing.status, 404);
        assert.equal(await missing.text(), '');
        assert.deepEqual(calls.map(c => c.kind), ['read']);
        for (const [items, message] of [
            [[{ ingredientID: ingredientA, quantity: 1 }, { ingredientID: ingredientA, quantity: 2 }], 'Duplicate key'],
            [[{ quantity: 1 }], 'Foreign key violation']
        ]) {
            reset();
            const failed = await send({ description: 'Saved before replacement', ingredients: items });
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message });
            assert.equal(recipe.Description, 'Saved before replacement');
            assert.deepEqual(storedIngredients, []);
            assert.deepEqual(calls.map(c => c.kind), ['read', 'save-removals', 'save-replacements']);
        }
        for (const stage of ['read', 'save-removals', 'save-replacements']) {
            reset(); failure = stage;
            const failed = await send({ description: 'New', ingredients: [{ ingredientID: ingredientA, quantity: 1 }] });
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: stage === 'read' ? 'Read failed' : 'Save failed' });
            if (stage === 'save-removals') {
                assert.equal(recipe.Description, 'Old description');
                assert.deepEqual(storedIngredients, [{ ingredientId: 'old', quantity: 9 }]);
            }
        }
    } finally {
        db.queryOne = originals.queryOne; db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
