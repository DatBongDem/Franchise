const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('order IDs by store matches C# token scope, STORESTAFF access and array response', async () => {
    const original = db.query;
    const storeId = '00000000-0000-0000-0000-000000000001';
    let rows = [{ OrderId: 'order-a' }, { OrderId: 'order-b' }], failure = false, reads = 0;
    db.query = async (sql, params) => {
        reads++; assert.equal(sql, 'SELECT OrderId FROM Orders WHERE StoreId = @storeId'); assert.deepEqual(params, { storeId });
        if (failure) throw new Error('Read failed'); return rows;
    };
    const app = express(); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'STORESTAFF', tokenStore = storeId) => {
        const token = jwt.sign({ role, IdStore: tokenStore }, config.jwt.secret, { issuer: config.jwt.issuer, audience: config.jwt.audience });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/by-store?storeId=other-store`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send(null)).status, 401);
        for (const role of ['ADMIN', 'MANAGER', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) assert.equal((await send(role)).status, 403);
        for (const invalid of [null, '', 'invalid']) {
            const denied = await send('STORESTAFF', invalid);
            assert.equal(denied.status, 401); assert.deepEqual(await denied.json(), { message: 'Store ID not found in token.' });
        }
        assert.equal(reads, 0);
        const success = await send(); assert.equal(success.status, 200); assert.deepEqual(await success.json(), ['order-a', 'order-b']);
        rows = [];
        const empty = await send(); assert.equal(empty.status, 200); assert.deepEqual(await empty.json(), []);
        failure = true;
        const failed = await send(); assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An error occurred while retrieving order IDs by store.', error: 'Read failed' });
    } finally {
        db.query = original; await new Promise(resolve => server.close(resolve));
    }
});
