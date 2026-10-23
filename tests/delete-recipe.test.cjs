const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('delete recipe matches C# public access, missing-record exception and errors', async () => {
    const original = db.execute;
    const id = '00000000-0000-0000-0000-000000000001';
    let exists = true, failure = false, writes = 0;
    db.execute = async (sql, params) => {
        writes++; assert.equal(sql, 'DELETE FROM Recipes WHERE RecipeID = @id'); assert.deepEqual(params, { id });
        if (failure) throw new Error('Delete failed');
        const affected = exists ? 1 : 0; exists = false;
        return { rowsAffected: [affected] };
    };
    const app = express(); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (recipeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/recipe/${recipeId}`, { method: 'DELETE' });
    try {
        assert.equal((await send('invalid')).status, 400); assert.equal(writes, 0);
        const success = await send();
        assert.equal(success.status, 200); assert.equal(await success.json(), 'Recipe deleted successfully');
        const missing = await send();
        assert.equal(missing.status, 500); assert.deepEqual(await missing.json(), { message: `Not found Recipe with Id: ${id}` });
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500); assert.deepEqual(await failed.json(), { message: 'Delete failed' });
    } finally {
        db.execute = original; await new Promise(resolve => server.close(resolve));
    }
});
