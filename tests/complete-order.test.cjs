const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('completion matches C# state transition, Vietnam time, authorization and errors', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute, now: Date.now };
    const orderId = '00000000-0000-0000-0000-000000000001';
    const writes = [];
    let reads = 0;
    let order = { OrderId: orderId, Status: 'Arrived' };
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
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'STORESTAFF', id = orderId, body = {}) => {
        const token = jwt.sign({ sub: 'coordinator', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/${id}/complete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    };
    try {
        assert.equal((await send(null)).status, 401);
        for (const role of ['KITCHENSTAFF', 'SUPPLYCOORDINATOR', 'MANAGER', 'ADMIN']) {
            assert.equal((await send(role)).status, 403);
        }
        assert.equal((await send('STORESTAFF', 'invalid')).status, 400);
        assert.equal(reads, 0);
        assert.equal(writes.length, 0);

        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), { message: 'Order marked as completed successfully.' });
        assert.equal(writes.length, 1);
        assert.match(writes[0].sql, /UPDATE Orders SET Status = @status, CompletedTime = @now, Feedback = @feedback WHERE OrderId = @orderId/);
        assert.equal(writes[0].params.orderId, orderId);
        assert.equal(writes[0].params.status, 'Completed');
        assert.equal(writes[0].params.now.toISOString(), '2026-10-23T03:30:00.000Z');
        assert.equal(writes[0].params.feedback, null);

        // Preserve text, empty and null feedback, accepting either DTO casing.
        for (const [body, expected] of [
            [{ feedback: 'Good delivery' }, 'Good delivery'],
            [{ Feedback: 'Original DTO' }, 'Original DTO'],
            [{ feedback: '' }, ''],
            [{ Feedback: '' }, ''],
            [{ feedback: null }, null]
        ]) {
            order = { OrderId: orderId, Status: 'Arrived' };
            const before = writes.length;
            assert.equal((await send('STORESTAFF', orderId, body)).status, 200);
            // C# completes only the order: never reset batch stock or status.
            assert.equal(writes.length, before + 1);
            assert.doesNotMatch(writes.at(-1).sql, /ProductBatches/);
            assert.equal(writes.at(-1).params.feedback, expected);
        }
        const readsBeforeInvalid = reads;
        const writesBeforeInvalid = writes.length;
        for (const body of [{ feedback: 123 }, { Feedback: {} }, []]) {
            assert.equal((await send('STORESTAFF', orderId, body)).status, 400);
        }
        assert.equal(reads, readsBeforeInvalid);
        assert.equal(writes.length, writesBeforeInvalid);
        writes.length = 1;

        // Every non-Arrived status must reject completion without changing the order.
        for (const status of ['Creating', 'Pending', 'PickedUp', 'WaitingForCooking', 'Cooking', 'Cooked', 'TakenFrom', 'Completed', 'Canceled']) {
            order = { OrderId: orderId, Status: status };
            const invalid = await send();
            assert.equal(invalid.status, 400);
            assert.deepEqual(await invalid.json(), { message: "Order status must be 'Arrived' to be marked as completed." });
            assert.equal(writes.length, 1);
        }
        order = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: `Order with ID ${orderId} not found.` });
        assert.equal(writes.length, 1);

        order = { OrderId: orderId, Status: 'Arrived' };
        for (const stage of ['read', 'write']) {
            failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), {
                message: 'An error occurred while completing the order.',
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

