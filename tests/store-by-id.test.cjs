const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store by ID matches C# DTO and error responses on both public routes', async () => {
    const originalQueryOne = db.queryOne;
    const id = '00000000-0000-0000-0000-000000000001';
    let row = { StoreId: id, StoreName: 'Store A', Address: null, Status: false };
    let reads = 0;
    let failure = false;
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        assert.match(sql, /SELECT StoreId, StoreName, Address, Status FROM Stores WHERE StoreId = @id/);
        if (failure) throw new Error('Store lookup failed');
        return row;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (prefix, storeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/${prefix}/${storeId}`);
    try {
        for (const prefix of ['Stores', 'store']) {
            const before = reads;
            assert.equal((await send(prefix, 'invalid')).status, 400);
            assert.equal(reads, before);
            row = { StoreId: id, StoreName: 'Store A', Address: null, Status: false };
            const success = await send(prefix);
            assert.equal(success.status, 200);
            assert.deepEqual(await success.json(), { storeId: id, storeName: 'Store A', address: null, status: false });
            row = { ...row, Address: '123 Main Street', Status: true };
            const active = await send(prefix);
            assert.equal(active.status, 200);
            assert.deepEqual(await active.json(), { storeId: id, storeName: 'Store A', address: '123 Main Street', status: true });
            row = null;
            const missing = await send(prefix);
            assert.equal(missing.status, 400);
            assert.equal(await missing.json(), 'Store not found');
            failure = true;
            const failed = await send(prefix);
            assert.equal(failed.status, 400);
            assert.equal(await failed.json(), 'Store lookup failed');
            failure = false;
        }
    } finally {
        db.queryOne = originalQueryOne;
        await new Promise(resolve => server.close(resolve));
    }
});
