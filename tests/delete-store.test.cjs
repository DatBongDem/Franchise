const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store deletion matches C# success, missing record and errors on both public routes', async () => {
    const originalExecute = db.execute;
    const id = '00000000-0000-0000-0000-000000000001';
    let existing = true;
    let failure = false;
    const calls = [];
    db.execute = async (sql, params) => {
        calls.push({ sql, params });
        assert.equal(sql, 'DELETE FROM Stores WHERE StoreId = @id');
        assert.deepEqual(params, { id });
        if (failure) throw new Error('Deletion blocked by related records');
        const count = existing ? 1 : 0;
        existing = false;
        return { rowsAffected: [count] };
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (prefix, storeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/${prefix}/${storeId}`, { method: 'DELETE' });
    try {
        for (const prefix of ['Stores', 'store']) {
            const before = calls.length;
            assert.equal((await send(prefix, 'invalid')).status, 400);
            assert.equal(calls.length, before);
            existing = true;
            const success = await send(prefix);
            assert.equal(success.status, 200);
            assert.equal(await success.json(), 'Delete store successfully');
            assert.equal(calls.length, before + 1);
            const missing = await send(prefix);
            assert.equal(missing.status, 400);
            assert.equal(await missing.json(), `Not found Store with Id: ${id}`);
            failure = true;
            const failed = await send(prefix);
            assert.equal(failed.status, 400);
            assert.equal(await failed.json(), 'Deletion blocked by related records');
            failure = false;
        }
    } finally {
        db.execute = originalExecute;
        await new Promise(resolve => server.close(resolve));
    }
});
