const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('order history matches C# store authorization, date filters, pagination and detail DTOs', async () => {
    const originals = { queryOne: db.queryOne, query: db.query };
    const userId = '00000000-0000-0000-0000-000000000001';
    const storeId = 'aaaaaaaa-0000-0000-0000-000000000002';
    const otherStore = '00000000-0000-0000-0000-000000000003';
    const orderA = 'aaaaaaaa-0000-0000-0000-000000000004';
    const orderB = 'bbbbbbbb-0000-0000-0000-000000000005';
    let user, orders, batches, total, failure;
    const calls = [];
    const reset = () => {
        user = { Id: userId, Role: 'MANAGER', IdStore: storeId.toUpperCase() };
        orders = [
            { OrderId: orderA, UserId: userId, SentTime: new Date('2026-10-22T12:00:00Z'), TotalAmount: 500, Status: 'Completed' },
            { OrderId: orderB, UserId: null, SentTime: null, TotalAmount: 0, Status: 'Creating' }
        ];
        batches = [
            { OrderId: orderA.toUpperCase(), ProductId: 'product', ProductName: 'Bread', BatchId: 'batch-a', QualityOrder: 5, Price: 500 },
            { OrderId: orderA, ProductId: 'product', ProductName: 'Bread', BatchId: 'batch-b', QualityOrder: 2, Price: 200 }
        ];
        total = 12; failure = ''; calls.length = 0;
    };
    const record = (kind, sql, params) => {
        calls.push({ kind, sql, params });
        if (failure === kind) throw new Error('Database unavailable');
    };
    db.queryOne = async (sql, params) => {
        if (sql.includes('FROM Users')) { record('user', sql, params); assert.deepEqual(params, { userId }); return user; }
        record('count', sql, params); return { count: total };
    };
    db.query = async (sql, params) => {
        if (sql.includes('FROM Orders WHERE')) { record('orders', sql, params); return orders; }
        record('details', sql, params);
        assert.deepEqual(JSON.parse(params.orderIds), orders.map(o => o.OrderId));
        assert.match(sql, /JOIN Products/);
        assert.doesNotMatch(sql, /isDeleted|SellingPrice/i);
        return batches;
    };
    const app = express(); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (query = '', role = 'MANAGER', sub = userId, store = storeId) => {
        const token = jwt.sign({ role, ...(sub == null ? {} : { sub }) }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/order-history/${store}${query}`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        reset();
        assert.equal((await send('', null)).status, 401);
        for (const role of ['ADMIN', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) assert.equal((await send('', role)).status, 403);
        assert.equal((await send('', 'MANAGER', userId, 'invalid')).status, 400);
        for (const query of ['?PageNumber=2abc', '?PageSize=1.5', '?PageSize=2147483648', '?FromDate=invalid', '?ToDate=2026-02-30', '?PageNumber=1&PageNumber=2']) {
            assert.equal((await send(query)).status, 400);
        }
        for (const sub of [null, 'invalid']) {
            const invalid = await send('', 'MANAGER', sub);
            assert.equal(invalid.status, 403);
            assert.deepEqual(await invalid.json(), { message: 'User ID not found in token.' });
        }
        assert.equal(calls.length, 0);
        user = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'User not found' });
        for (const dbUser of [{ Role: 'STORESTAFF', IdStore: storeId }, { Role: 'MANAGER', IdStore: otherStore }]) {
            reset(); user = dbUser;
            const denied = await send('', dbUser.Role);
            assert.equal(denied.status, 403);
            assert.deepEqual(await denied.json(), { message: 'User does not have permission!!!' });
            assert.deepEqual(calls.map(c => c.kind), ['user']);
        }
        reset();
        const response = await send('?FromDate=2026-10-01T08:30:00&ToDate=2026-10-22T23:59:59&PageNumber=2&PageSize=5');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            status: 0, totalRecords: 12, pageNumber: 2, pageSize: 5,
            data: [
                { orderId: orderA, orderBy: userId, createdTime: '2026-10-22T12:00:00.000Z', totalAmount: 500, status: 'Completed', details: [
                    { productId: 'product', productName: 'Bread', batchId: 'batch-a', quantity: 5, unitPrice: 500 },
                    { productId: 'product', productName: 'Bread', batchId: 'batch-b', quantity: 2, unitPrice: 200 }
                ] },
                { orderId: orderB, orderBy: null, createdTime: null, totalAmount: 0, status: 'Creating', details: [] }
            ], message: 'Get Orders history successfully'
        });
        assert.deepEqual(calls.map(c => c.kind), ['user', 'count', 'orders', 'details']);
        for (const call of calls.filter(c => ['count', 'orders'].includes(c.kind))) {
            assert.match(call.sql, /StoreId = @storeId AND SentTime >= @fromDate AND SentTime <= @toDate/);
            assert.equal(call.params.fromDate.toISOString(), '2026-10-01T08:30:00.000Z');
            assert.equal(call.params.toDate.toISOString(), '2026-10-22T23:59:59.000Z');
        }
        assert.equal(calls[2].params.offset, 5);
        assert.match(calls[2].sql, /ORDER BY SentTime DESC/);
        reset(); orders = []; total = 0;
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), { status: 0, totalRecords: 0, pageNumber: 1, pageSize: 10, data: [], message: 'No Orders history found' });
        assert.equal(calls.some(c => c.kind === 'details'), false);
        assert.doesNotMatch(calls[1].sql, /SentTime [<>]/);
        reset(); orders = [];
        const beyond = await send('?pageNumber=99&pageSize=10&fromDate=2026-10-01');
        assert.equal(beyond.status, 200);
        assert.equal((await beyond.json()).totalRecords, 12);
        assert.match(calls[1].sql, /SentTime >= @fromDate/);
        assert.doesNotMatch(calls[1].sql, /SentTime <=/);
        for (const stage of ['user', 'count', 'orders', 'details']) {
            reset(); failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.equal(await failed.json(), 'An internal error occurred.');
        }
    } finally {
        db.queryOne = originals.queryOne; db.query = originals.query;
        await new Promise(resolve => server.close(resolve));
    }
});
