const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('kitchen orders return C# DTO details, isolated batches, empty results and auth/errors', async () => {
    const originalQuery = db.query;
    const calls = [];
    const makeOrder = (id, status) => ({
        OrderId: id, UserId: null, StoreId: 'store', TotalAmount: 250,
        Status: status, Type: 'Normal', Note: null, SentTime: null,
        PickedUpTime: null, KitchenReceivedTime: null, CookingTime: null,
        CookedTime: null, TakenFromKitchenTime: null, ArrivedTime: null,
        CompletedTime: null, CancelledTime: null, Feedback: null
    });
    let orders = [makeOrder('order-a', 'WaitingForCooking'), makeOrder('order-b', 'Cooking'), makeOrder('order-c', 'Cooked')];
    const batch = (orderId, id) => ({
        OrderId: orderId, BatchId: id, ProductId: 'product', ProductName: 'Bread',
        Price: 25, Unit: 'piece', QualityOrder: 10, Status: 'Cooking',
        Manufacture: null, Expiry: null
    });
    const batches = [batch('ORDER-A', 'a1'), batch('order-a', 'a2'), batch('order-b', 'b1')];
    let failOn = '';
    db.query = async (sql, params) => {
        const kind = sql.includes('FROM ProductBatches') ? 'batches' : 'orders';
        calls.push({ kind, sql, params });
        if (failOn === kind) throw new Error('Database unavailable');
        assert.deepEqual(params, { s1: 'WaitingForCooking', s2: 'Cooking', s3: 'Cooked' });
        assert.match(sql, /o.Status IN \(@s1, @s2, @s3\)/);
        assert.doesNotMatch(sql, /JOIN Stores|isDeleted/i);
        return kind === 'batches' ? batches : orders;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'KITCHENSTAFF') => {
        const token = jwt.sign({ sub: 'user', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/orders`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        const response = await send();
        assert.equal(response.status, 200);
        const result = await response.json();
        const expectedOrder = Object.fromEntries(Object.entries(orders[0]).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]));
        const expectedBatches = batches.slice(0, 2).map(({ OrderId, ...detail }) =>
            Object.fromEntries(Object.entries(detail).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]))
        );
        assert.deepEqual(result[0], { ...expectedOrder, productBatches: expectedBatches });
        assert.deepEqual(result[1].productBatches.map(b => b.batchId), ['b1']);
        assert.deepEqual(result[2].productBatches, []);
        assert.equal(result.length, 3);
        assert.equal(calls.length, 2);
        assert.match(calls[1].sql, /JOIN Products p ON pb.ProductId = p.ProductId/);
        calls.length = 0;
        assert.equal((await send(null)).status, 401);
        assert.equal(calls.length, 0);
        // C# permits every authenticated role to read this endpoint.
        assert.equal((await send('STORESTAFF')).status, 200);
        for (const source of ['orders', 'batches']) {
            failOn = source;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), {
                message: 'An error occurred while retrieving kitchen orders.', error: 'Database unavailable'
            });
        }
        failOn = '';
        orders = [];
        calls.length = 0;
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), []);
        assert.equal(calls.length, 1);
    } finally {
        db.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
