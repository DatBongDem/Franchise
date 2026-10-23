const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store list matches C# DTO, inactive stores, empty result and errors on both public routes', async () => {
    const originalQuery = db.query;
    let rows = [];
    let failure = false;
    let reads = 0;
    db.query = async sql => {
        reads++;
        assert.match(sql, /^SELECT StoreId, StoreName, Address, Status FROM Stores$/);
        if (failure) throw new Error('Store lookup failed');
        return rows;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = prefix => fetch(`http://127.0.0.1:${server.address().port}/api/${prefix}`);
    try {
        for (const prefix of ['Stores', 'store']) {
            rows = [
                { StoreId: 'store-a', StoreName: 'Active store', Address: '123 Main Street', Status: true },
                { StoreId: 'store-b', StoreName: 'Inactive store', Address: null, Status: false }
            ];
            const before = reads;
            const success = await send(prefix);
            assert.equal(success.status, 200);
            assert.deepEqual(await success.json(), [
                { storeId: 'store-a', storeName: 'Active store', address: '123 Main Street', status: true },
                { storeId: 'store-b', storeName: 'Inactive store', address: null, status: false }
            ]);
            assert.equal(reads, before + 1);
            rows = [];
            const empty = await send(prefix);
            assert.equal(empty.status, 200);
            assert.deepEqual(await empty.json(), []);
            failure = true;
            const failed = await send(prefix);
            assert.equal(failed.status, 400);
            assert.equal(await failed.json(), 'Store lookup failed');
            failure = false;
        }
    } finally {
        db.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
