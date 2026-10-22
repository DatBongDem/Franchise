const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store update matches C# address replacement, validation and errors on both public routes', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const id = '00000000-0000-0000-0000-000000000001';
    let existing = true;
    let failure = '';
    let reads = 0;
    const writes = [];
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        if (failure === 'read') throw new Error('Lookup failed');
        return existing ? { StoreId: id, StoreName: 'Old name', Address: 'Old address', Status: false } : null;
    };
    db.execute = async (sql, params) => {
        if (failure === 'write') throw new Error('Update failed');
        writes.push({ sql, params });
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (prefix, body, storeId = id) => fetch(`http://127.0.0.1:${server.address().port}/api/${prefix}/${storeId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    try {
        for (const prefix of ['Stores', 'store']) {
            const before = reads;
            assert.equal((await send(prefix, { storeName: 'Name' }, 'invalid')).status, 400);
            for (const body of [{}, { storeName: null }, { storeName: 123 }, { storeName: 'Name', address: {} }, []]) {
                assert.equal((await send(prefix, body)).status, 400);
            }
            assert.equal(reads, before);
            for (const [body, name, address] of [
                [{ storeName: 'New name', address: 'New address', status: true }, 'New name', 'New address'],
                [{ StoreName: 'Name', Address: null }, 'Name', null],
                [{ storeName: 'Name' }, 'Name', null],
                [{ storeName: '', address: '' }, '', '']
            ]) {
                const response = await send(prefix, body);
                assert.equal(response.status, 200);
                assert.equal(await response.json(), 'Update store successfully');
                assert.deepEqual(writes.at(-1).params, { id, storeName: name, address });
                assert.match(writes.at(-1).sql, /UPDATE Stores SET StoreName = @storeName, Address = @address WHERE StoreId = @id/);
                assert.doesNotMatch(writes.at(-1).sql, /Status|INSERT|DELETE/i);
            }
            existing = false;
            const count = writes.length;
            const missing = await send(prefix, { storeName: 'Name' });
            assert.equal(missing.status, 400);
            assert.equal(await missing.json(), 'Store not found');
            assert.equal(writes.length, count);
            existing = true;
            for (const stage of ['read', 'write']) {
                failure = stage;
                const failed = await send(prefix, { storeName: 'Name' });
                assert.equal(failed.status, 400);
                assert.equal(await failed.json(), stage === 'read' ? 'Lookup failed' : 'Update failed');
            }
            failure = '';
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
