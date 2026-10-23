const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('recipe list matches C# entity shape, public access, empty list and query errors', async () => {
    const originalQuery = db.query;
    let rows = [
        { RecipeID: 'recipe-a', ProductID: 'product-a', Description: 'Mix flour' },
        { RecipeID: 'recipe-b', ProductID: 'product-b', Description: '' }
    ];
    let failure = false;
    let reads = 0;
    db.query = async sql => {
        reads++;
        assert.match(sql, /^SELECT RecipeID, ProductID, Description FROM Recipes$/);
        assert.doesNotMatch(sql, /JOIN|WHERE|RecipeIngredients|ProductName/i);
        if (failure) throw new Error('Database unavailable');
        return rows;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = () => fetch(`http://127.0.0.1:${server.address().port}/api/recipe`);
    try {
        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), [
            { recipeID: 'recipe-a', productID: 'product-a', description: 'Mix flour', recipeIngredients: [] },
            { recipeID: 'recipe-b', productID: 'product-b', description: '', recipeIngredients: [] }
        ]);
        assert.equal(reads, 1);
        rows = [];
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), []);
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
    } finally {
        db.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
