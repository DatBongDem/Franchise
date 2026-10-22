const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('recipe by ID matches C# entity shape, public access, null result and validation', async () => {
    const originals = { queryOne: db.queryOne, query: db.query };
    const id = '00000000-0000-0000-0000-000000000001';
    const productID = '00000000-0000-0000-0000-000000000002';
    let row = { RecipeID: id, ProductID: productID, Description: 'Mix flour and water' };
    let reads = 0;
    let failure = false;
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        assert.match(sql, /SELECT RecipeID, ProductID, Description FROM Recipes WHERE RecipeID = @id/);
        assert.doesNotMatch(sql, /JOIN|RecipeIngredients|isDeleted/i);
        if (failure) throw new Error('Database unavailable');
        return row;
    };
    db.query = async () => { throw new Error('Ingredient collection must not be loaded'); };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (recipeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/recipe/${recipeId}`);
    try {
        const invalid = await send('invalid');
        assert.equal(invalid.status, 400);
        assert.equal(reads, 0);
        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), {
            recipeID: id, productID, description: 'Mix flour and water', recipeIngredients: []
        });
        assert.equal(reads, 1);
        row = { ...row, Description: '' };
        const emptyDescription = await send();
        assert.equal(emptyDescription.status, 200);
        assert.equal((await emptyDescription.json()).description, '');
        row = null;
        const missing = await send();
        assert.equal(missing.status, 204);
        assert.equal(await missing.text(), '');
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
    } finally {
        db.queryOne = originals.queryOne;
        db.query = originals.query;
        await new Promise(resolve => server.close(resolve));
    }
});
