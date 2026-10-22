const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('arrival matches C# state transition, Vietnam time, public access and errors', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute, now: Date.now };
    const orderId = '00000000-0000-0000-0000-000000000001';
    const writes = [];
    let reads = 0;
    let order = { OrderId: orderId, Status: 'TakenFrom' };
    let failure = '';
    Date.now = () => Date.parse('2026-10-22T20:30:00Z');
    db.queryOne = async (sql, params) => {
        reads++;
        assert.equal(params.orderId, orderId);
        if (failure === 'read') throw new Error('Read failed');
        return order;
    };
    db.execute = async (sql, params) => {
        if (failure === 'write') throw new Error('Write failed');
        writes.push({ sql, params });
        order = { ...order, Status: params.status };
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'SUPPLYCOORDINATOR', id = orderId) => {
        const token = jwt.sign({ sub: 'coordinator', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/delivery/${id}/arrive-at-store`, {
            method: 'PUT', headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send('SUPPLYCOORDINATOR', 'invalid')).status, 400);
        assert.equal(reads, 0);
        assert.equal(writes.length, 0);

        const success = await send(null);
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), { message: 'Order has arrived at the store successfully.' });
        assert.equal(writes.length, 1);
        assert.match(writes[0].sql, /UPDATE Orders SET Status = @status, ArrivedTime = @now WHERE OrderId = @orderId/);
        assert.equal(writes[0].params.orderId, orderId);
        assert.equal(writes[0].params.status, 'Arrived');
        assert.equal(writes[0].params.now.toISOString(), '2026-10-23T03:30:00.000Z');

        // The C# endpoint is public; an optional token does not restrict roles.
        for (const role of ['SUPPLYCOORDINATOR', 'KITCHENSTAFF', 'STORESTAFF', 'MANAGER', 'ADMIN']) {
            order = { OrderId: orderId, Status: 'TakenFrom' };
            assert.equal((await send(role)).status, 200);
        }
        writes.length = 1;

        // Every non-TakenFrom status must reject arrival without changing the order.
        for (const status of ['Creating', 'Pending', 'PickedUp', 'WaitingForCooking', 'Cooking', 'Cooked', 'Arrived', 'Completed', 'Canceled']) {
            order = { OrderId: orderId, Status: status };
            const invalid = await send();
            assert.equal(invalid.status, 400);
            assert.deepEqual(await invalid.json(), { message: "Order status must be 'TakenFromKitchen' to be marked as arrived." });
            assert.equal(writes.length, 1);
        }
        order = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: `Order with ID ${orderId} not found.` });
        assert.equal(writes.length, 1);

        order = { OrderId: orderId, Status: 'TakenFrom' };
        for (const stage of ['read', 'write']) {
            failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), {
                message: 'An error occurred while marking the order as arrived.',
                error: stage === 'read' ? 'Read failed' : 'Write failed'
            });
            assert.equal(writes.length, 1);
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        Date.now = originals.now;
        await new Promise(resolve => server.close(resolve));
    }
});



