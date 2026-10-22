const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('ingredient update matches C# fields, validation, public access and missing records', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const id = '00000000-0000-0000-0000-000000000001';
    let existing = true;
    let failure = '';
    const reads = [], writes = [];
    db.queryOne = async (sql, params) => {
        reads.push(params);
        assert.deepEqual(params, { id });
        if (failure === 'read') throw new Error('Read failed');
        return existing ? { IngredientId: id, IngredientName: 'Flour', Unit: 'kg', Status: 'Active' } : null;
    };
    db.execute = async (sql, params) => {
        if (failure === 'write') throw new Error('Write failed');
        writes.push({ sql, params });
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (body, ingredientId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/ingredient/${ingredientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    try {
        assert.equal((await send({ ingredientName: 'Flour', unit: 'kg' }, 'invalid')).status, 404);
        for (const body of [{}, { ingredientName: 'Flour' }, { unit: 'kg' }, { ingredientName: null, unit: 'kg' },
            { ingredientName: 123, unit: 'kg' }, { ingredientName: 'Flour', unit: {} }, []]) {
            assert.equal((await send(body)).status, 400);
        }
        assert.equal(reads.length, 0);
        assert.equal(writes.length, 0);
        for (const [body, expected] of [
            [{ ingredientName: 'Rice flour', unit: 'g', status: 'Blocked' }, { id, name: 'Rice flour', unit: 'g' }],
            [{ IngredientName: 'Sugar', Unit: 'kg', Status: 'Blocked' }, { id, name: 'Sugar', unit: 'kg' }],
            [{ ingredientName: '', unit: '' }, { id, name: '', unit: '' }]
        ]) {
            const success = await send(body);
            assert.equal(success.status, 200);
            assert.equal(await success.json(), 'Ingredient updated successfully');
            assert.deepEqual(writes.at(-1).params, expected);
            assert.match(writes.at(-1).sql, /UPDATE Ingredients/);
            assert.doesNotMatch(writes.at(-1).sql, /Status|INSERT|DELETE/i);
        }
        const before = writes.length;
        existing = false;
        const missing = await send({ ingredientName: 'Flour', unit: 'kg' });
        assert.equal(missing.status, 404);
        assert.equal(await missing.text(), '');
        assert.equal(writes.length, before);
        existing = true;
        for (const stage of ['read', 'write']) {
            failure = stage;
            const failed = await send({ ingredientName: 'Flour', unit: 'kg' });
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
