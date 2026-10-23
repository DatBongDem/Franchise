const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('cancel order matches C# DTO, reasons, state rules, Vietnam time, errors and nullable-user edge', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute, now: Date.now };
    const id = '00000000-0000-0000-0000-000000000001';
    const userId = '00000000-0000-0000-0000-000000000002';
    const template = {
        OrderId: id, UserId: userId, StoreId: 'store', TotalAmount: 100, Status: 'Pending', Type: 'Normal', Note: 'Note',
        SentTime: new Date('2026-10-22T12:00:00Z'), PickedUpTime: null, KitchenReceivedTime: null,
        CookingTime: null, CookedTime: null, TakenFromKitchenTime: null, ArrivedTime: null,
        CompletedTime: null, CancelledTime: null, CancellationReason: 'Old reason', Feedback: null
    };
    let order, failure;
    const calls = [];
    const reset = () => { order = { ...template }; failure = ''; calls.length = 0; };
    Date.now = () => Date.parse('2026-10-23T20:30:00Z');
    db.queryOne = async (sql, params) => {
        calls.push({ kind: 'read', params });
        assert.deepEqual(params, { orderId: id });
        if (failure === 'read') throw new Error('Read failed');
        return order;
    };
    db.execute = async (sql, params) => {
        calls.push({ kind: 'write', sql, params });
        assert.match(sql, /UPDATE Orders/);
        assert.doesNotMatch(sql, /ProductBatches|INSERT|DELETE/i);
        if (failure === 'write') throw new Error('Write failed');
        return { rowsAffected: [1] };
    };
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (body = {}, role = 'STORESTAFF', orderId = id) => {
        // No user-ID claim is required by the C# cancel action, only authentication.
        const token = jwt.sign({ role }, config.jwt.secret, { issuer: config.jwt.issuer, audience: config.jwt.audience });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/${orderId}/cancel`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(body)
        });
    };
    try {
        reset();
        assert.equal((await send({}, null)).status, 401);
        assert.equal((await send({}, 'STORESTAFF', 'invalid')).status, 400);
        for (const body of [[], { cancellationReason: 123 }, { CancellationReason: {} }, { cancellationReason: false }]) {
            assert.equal((await send(body)).status, 400);
        }
        assert.equal(calls.length, 0);
        for (const [body, reason] of [[{ cancellationReason: 'Changed plans' }, 'Changed plans'],
            [{ CancellationReason: '' }, ''], [{ cancellationReason: null }, null], [{}, null],
            [{ CANCELLATIONREASON: 'Mixed casing' }, 'Mixed casing']]) {
            reset();
            const response = await send(body);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                orderId: id, userId, storeId: 'store', totalAmount: 100, status: 'Canceled', type: 'Normal', note: 'Note',
                sentTime: '2026-10-22T12:00:00.000Z', pickedUpTime: null, kitchenReceivedTime: null,
                cookingTime: null, cookedTime: null, takenFromKitchenTime: null, arrivedTime: null,
                completedTime: null, cancelledTime: '2026-10-24T03:30:00.000Z', cancellationReason: reason, feedback: null
            });
            assert.deepEqual(calls.map(c => c.kind), ['read', 'write']);
            assert.deepEqual(calls[1].params, { orderId: id, status: 'Canceled', reason, now: new Date('2026-10-24T03:30:00Z') });
        }
        for (const role of ['ADMIN', 'MANAGER', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            reset(); assert.equal((await send({}, role)).status, 200);
        }
        for (const status of ['Creating', 'Pending', 'PickedUp', 'WaitingForCooking', 'Cooking', 'Cooked', 'TakenFrom', 'Arrived']) {
            reset(); order.Status = status;
            assert.equal((await send()).status, 200);
        }
        for (const status of ['Completed', 'Canceled']) {
            reset(); order.Status = status;
            const invalid = await send();
            assert.equal(invalid.status, 400);
            assert.deepEqual(await invalid.json(), { message: `Order in status '${status}' cannot be cancelled.` });
            assert.deepEqual(calls.map(c => c.kind), ['read']);
        }
        reset(); order = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: `Order with ID ${id} not found.` });
        assert.deepEqual(calls.map(c => c.kind), ['read']);
        reset(); order.UserId = null;
        const nullableUser = await send();
        assert.equal(nullableUser.status, 400);
        assert.deepEqual(await nullableUser.json(), { message: 'Nullable object must have a value.' });
        assert.deepEqual(calls.map(c => c.kind), ['read', 'write']);
        for (const stage of ['read', 'write']) {
            reset(); failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An error occurred while cancelling the order.', error: stage === 'read' ? 'Read failed' : 'Write failed' });
        }
    } finally {
        db.queryOne = originals.queryOne; db.execute = originals.execute; Date.now = originals.now;
        await new Promise(resolve => server.close(resolve));
    }
});
