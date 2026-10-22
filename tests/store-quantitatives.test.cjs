const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store quantitative listing matches C# token scope, DTO and query behavior', async () => {
    const originalQuery = db.query;
    const storeId = '00000000-0000-0000-0000-000000000001';
    const otherStoreId = '00000000-0000-0000-0000-000000000002';
    const calls = [];
    let failure = false;
    let rows = [
        { StoreId: storeId, ProductId: 'active', ProductName: 'Bread', Quantity: 10 },
        { StoreId: storeId, ProductId: 'deleted', ProductName: 'Old product', Quantity: 0 },
        { StoreId: storeId, ProductId: 'missing', ProductName: 'Unknown Product', Quantity: 7 }
    ];
    db.query = async (sql, params) => {
        calls.push({ sql, params });
        if (failure) throw new Error('Database unavailable');
        assert.deepEqual(params, { storeId });
        assert.match(sql, /LEFT JOIN Products p ON q.ProductId = p.ProductId/);
        assert.match(sql, /CASE WHEN p.ProductId IS NULL THEN N'Unknown Product' ELSE p.ProductName END/);
        assert.match(sql, /WHERE q.StoreId = @storeId/);
        assert.doesNotMatch(sql, /isDeleted/i);
        return rows;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (tokenStore = storeId, role = 'STORESTAFF', claimName = 'IdStore') => {
        const token = jwt.sign({ sub: 'user', role, [claimName]: tokenStore }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/quantitative?storeId=${otherStoreId}`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send(storeId, null)).status, 401);
        for (const invalidStore of [null, '', 'invalid']) {
            const invalid = await send(invalidStore);
            assert.equal(invalid.status, 401);
            assert.deepEqual(await invalid.json(), { message: 'Store ID not found or invalid in token.' });
        }
        assert.equal(calls.length, 0);
        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), [
            { storeId, productId: 'active', productName: 'Bread', quantity: 10 },
            { storeId, productId: 'deleted', productName: 'Old product', quantity: 0 },
            { storeId, productId: 'missing', productName: 'Unknown Product', quantity: 7 }
        ]);
        assert.equal(calls.length, 1);
        // C# permits every authenticated role; Node tokens use either claim casing.
        for (const role of ['ADMIN', 'MANAGER', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send(storeId, role, 'idStore')).status, 200);
        }
        rows = [];
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), []);
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An unexpected error occurred.', details: 'Database unavailable' });
    } finally {
        db.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
