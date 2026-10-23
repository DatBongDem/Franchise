const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store shrinkage matches C# cost grouping, UTC cutoff, permission and DTOs', async () => {
    const originals = { queryOne: db.queryOne, query: db.query, now: Date.now };
    const userId = '00000000-0000-0000-0000-000000000001';
    const storeId = 'aaaaaaaa-0000-0000-0000-000000000002';
    const otherStore = '00000000-0000-0000-0000-000000000003';
    const timestamp = '2026-10-23T02:30:00.000Z';
    let user, rows, failure;
    const calls = [];
    const reset = () => {
        user = { Id: userId, Role: 'MANAGER', IdStore: storeId.toUpperCase() };
        rows = [
            { StoreId: storeId, ProductId: 'product-a', ProductName: 'Bread', ExpiredDate: new Date('2026-10-21T00:00:00Z'),
                ExpiredQuantity: 3, LossAmount: 0.1, TotalExpiredQuantity: 5, TotalLossAmount: 0.3 },
            { StoreId: storeId, ProductId: 'product-a', ProductName: 'Bread', ExpiredDate: new Date('2026-10-22T00:00:00Z'),
                ExpiredQuantity: 2, LossAmount: 0.2, TotalExpiredQuantity: 5, TotalLossAmount: 0.3 }
        ];
        failure = ''; calls.length = 0;
    };
    Date.now = () => Date.parse(timestamp);
    db.queryOne = async (sql, params) => {
        calls.push({ kind: 'user', sql, params });
        assert.deepEqual(params, { userId });
        if (failure === 'user') throw new Error('Read failed');
        return user;
    };
    db.query = async (sql, params) => {
        calls.push({ kind: 'shrinkage', sql, params });
        if (failure === 'shrinkage') throw new Error('Read failed');
        assert.deepEqual(params, { storeId, now: new Date(timestamp) });
        assert.match(sql, /SUM\(pb.RemainingQuantity \* p.Price\)/);
        assert.match(sql, /o.StoreId = @storeId AND pb.Expiry IS NOT NULL/);
        assert.match(sql, /pb.Expiry < @now AND pb.RemainingQuantity > 0/);
        assert.match(sql, /GROUP BY o.StoreId, pb.ProductId, p.ProductName, CAST\(pb.Expiry AS date\)/);
        assert.match(sql, /ORDER BY ExpiredDate, ProductName/);
        assert.match(sql, /SUM\(LossAmount\) OVER \(\) AS TotalLossAmount/);
        assert.doesNotMatch(sql, /SellingPrice|o.Status|completedStatus|isDeleted|Expiry <=/i);
        return rows;
    };
    const app = express(); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const sign = (claims, secret = config.jwt.secret) => jwt.sign(claims, secret, { issuer: config.jwt.issuer, audience: config.jwt.audience });
    const send = (token = sign({ sub: userId, role: 'MANAGER' }), store = storeId) => fetch(
        `http://127.0.0.1:${server.address().port}/api/productbatches/${store}/shrinkage`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    try {
        reset();
        for (const token of [null, 'invalid-token', sign({ sub: userId }, 'wrong-secret'), sign({ sub: 'invalid' }), sign({ role: 'MANAGER' })]) {
            const invalid = await send(token);
            assert.equal(invalid.status, 403);
            assert.deepEqual(await invalid.json(), { message: 'User ID not found in token.' });
        }
        assert.equal((await send(undefined, 'invalid')).status, 400);
        assert.equal(calls.length, 0);
        user = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'User not found' });
        for (const dbUser of [{ Role: 'MANAGER', IdStore: otherStore }, { Role: 'ADMIN', IdStore: storeId },
            { Role: 'STORESTAFF', IdStore: storeId }, { Role: 'KITCHENSTAFF', IdStore: storeId }]) {
            reset(); user = dbUser;
            const denied = await send();
            assert.equal(denied.status, 403);
            assert.deepEqual(await denied.json(), { message: 'User does not have permission' });
            assert.deepEqual(calls.map(c => c.kind), ['user']);
        }
        reset();
        // Authorization uses the database user, not a role/store asserted by the token.
        const success = await send(sign({ sub: userId, role: 'STORESTAFF', IdStore: otherStore }));
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), {
            status: 0, data: {
                summary: { storeId, calculatedAt: timestamp, totalExpiredQuantity: 5, totalLossAmount: 0.3 },
                items: [
                    { storeId, productId: 'product-a', productName: 'Bread', expiredQuantity: 3, lossAmount: 0.1, expiredDate: '2026-10-21T00:00:00.000Z' },
                    { storeId, productId: 'product-a', productName: 'Bread', expiredQuantity: 2, lossAmount: 0.2, expiredDate: '2026-10-22T00:00:00.000Z' }
                ]
            }, message: 'Get store shrinkage successfully'
        });
        assert.deepEqual(calls.map(c => c.kind), ['user', 'shrinkage']);
        reset(); rows = [];
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), {
            status: 0, data: { summary: { storeId, calculatedAt: timestamp, totalExpiredQuantity: 0, totalLossAmount: 0 }, items: [] },
            message: 'No expired products found'
        });
        for (const stage of ['user', 'shrinkage']) {
            reset(); failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.equal(await failed.json(), 'An internal error occurred.');
        }
    } finally {
        db.queryOne = originals.queryOne; db.query = originals.query; Date.now = originals.now;
        await new Promise(resolve => server.close(resolve));
    }
});
