const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('finish cooking matches C# dates, updates, authorization and errors', async () => {
    const originals = { query: db.query, queryOne: db.queryOne, execute: db.execute, now: Date.now };
    const orderId = '00000000-0000-0000-0000-000000000001';
    const calls = [];
    let order = { OrderId: orderId, Status: 'Cooking' };
    let batches = [{ BatchId: 'batch-a', NumberOfDaysToExpire: 3 }, { BatchId: 'batch-b', NumberOfDaysToExpire: 0 }];
    let failure = false;
    Date.now = () => Date.parse('2026-10-22T20:30:00Z');
    db.queryOne = async () => order;
    db.query = async () => batches;
    db.execute = async (sql, params) => {
        if (failure) throw new Error('Database unavailable');
        calls.push({ sql, params });
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const token = role => jwt.sign({ sub: 'kitchen-user', role }, config.jwt.secret, {
        issuer: config.jwt.issuer, audience: config.jwt.audience
    });
    const send = (role = 'KITCHENSTAFF', id = orderId) => fetch(
        `http://127.0.0.1:${server.address().port}/api/order/${id}/finish-cooking`,
        { method: 'PUT', headers: role ? { Authorization: `Bearer ${token(role)}` } : {} }
    );
    try {
        const ok = await send();
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { message: 'Order has finished cooking.' });
        assert.equal(calls.length, 3);
        assert.match(calls[0].sql, /UPDATE Orders/);
        assert.equal(calls[0].params.status, 'Cooked');
        assert.equal(calls[0].params.now.toISOString(), '2026-10-23T03:30:00.000Z');
        for (const update of calls.slice(1)) {
            assert.equal(update.params.status, 'Cooked');
            assert.equal(update.params.manufacture.toISOString(), '2026-10-23T03:30:00.000Z');
        }
        assert.equal(calls[1].params.expiry.toISOString(), '2026-10-26T03:30:00.000Z');
        assert.equal(calls[2].params.expiry.toISOString(), '2026-10-23T03:30:00.000Z');
        calls.length = 0;
        assert.equal((await send(null)).status, 401);
        assert.equal((await send('STORESTAFF')).status, 403);
        assert.equal((await send('KITCHENSTAFF', 'invalid')).status, 400);
        assert.equal(calls.length, 0);
        order = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: `Order with ID ${orderId} not found.` });
        assert.equal(calls.length, 0);
        // C# allows completion without batches and does not restrict the previous status.
        order = { OrderId: orderId, Status: 'WaitingForCooking' };
        batches = [];
        assert.equal((await send()).status, 200);
        assert.equal(calls.length, 1);
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), {
            message: 'An error occurred while finishing cooking the order.', error: 'Database unavailable'
        });
    } finally {
        db.query = originals.query;
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        Date.now = originals.now;
        await new Promise(resolve => server.close(resolve));
    }
});
