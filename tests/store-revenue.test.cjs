const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store revenue matches C# authorization, calendar intervals, cost/profit SQL and DTOs', async () => {
    const originals = { queryOne: db.queryOne, query: db.query };
    const userId = '00000000-0000-0000-0000-000000000001';
    const storeId = 'aaaaaaaa-0000-0000-0000-000000000002';
    const otherStore = '00000000-0000-0000-0000-000000000003';
    let user, rows, failure;
    const calls = [];
    const reset = () => {
        user = { Id: userId, Role: 'MANAGER', IdStore: storeId.toUpperCase() };
        rows = [
            { StoreId: storeId, ProductId: 'product-a', ProductName: 'Bread', SaleDate: new Date('2026-10-22T09:15:00Z'),
                TotalQuantitySold: 1, TotalRevenue: 0.1, TotalCost: 0.05, Profit: 0.05,
                SummaryTotalRevenue: 0.3, SummaryTotalCost: 0.35, SummaryTotalProfit: -0.05 },
            { StoreId: storeId, ProductId: 'product-b', ProductName: 'Cake', SaleDate: new Date('2026-10-22T10:30:00Z'),
                TotalQuantitySold: 2, TotalRevenue: 0.2, TotalCost: 0.3, Profit: -0.1,
                SummaryTotalRevenue: 0.3, SummaryTotalCost: 0.35, SummaryTotalProfit: -0.05 }
        ];
        failure = ''; calls.length = 0;
    };
    db.queryOne = async (sql, params) => {
        calls.push({ kind: 'user', sql, params });
        assert.deepEqual(params, { userId });
        if (failure === 'user') throw new Error('Read failed');
        return user;
    };
    db.query = async (sql, params) => {
        calls.push({ kind: 'revenue', sql, params });
        if (failure === 'revenue') throw new Error('Read failed');
        assert.match(sql, /JOIN ProductBatches pb ON bd.BatchId = pb.BatchId/);
        assert.match(sql, /JOIN Products p ON pb.ProductId = p.ProductId/);
        assert.match(sql, /CAST\(SUM\(bd.Quantity \* bd.UnitPrice\) AS decimal\(28,2\)\) AS TotalRevenue/);
        assert.match(sql, /CAST\(SUM\(bd.Quantity \* p.Price\) AS decimal\(28,2\)\) AS TotalCost/);
        assert.match(sql, /CAST\(SUM\(bd.Quantity \* bd.UnitPrice\) AS decimal\(28,2\)\)\s*- CAST\(SUM\(bd.Quantity \* p.Price\) AS decimal\(28,2\)\) AS Profit/);
        assert.match(sql, /MIN\(b.CreatedTime\) AS SaleDate/);
        assert.match(sql, /b.StoreId = @storeId AND b.CreatedTime >= @fromDate AND b.CreatedTime < @toDate/);
        assert.match(sql, /GROUP BY b.StoreId, pb.ProductId, p.ProductName/);
        assert.match(sql, /SUM\(TotalRevenue\) OVER \(\) AS SummaryTotalRevenue/);
        assert.doesNotMatch(sql, /bd.TotalPrice|b.TotalAmount|isDeleted|SellingPrice/);
        return rows;
    };
    const app = express(); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (query = '?Date=2026-10-22', role = 'MANAGER', sub = userId, store = storeId) => {
        const token = jwt.sign({ role, ...(sub == null ? {} : { sub }) }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/bills/stores/${store}/revenue${query}`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        reset();
        assert.equal((await send(undefined, null)).status, 401);
        for (const role of ['KITCHENSTAFF', 'SUPPLYCOORDINATOR']) assert.equal((await send(undefined, role)).status, 403);
        assert.equal((await send(undefined, 'MANAGER', userId, 'invalid')).status, 400);
        for (const query of ['?Date=invalid', '?Date=2026-02-30', '?Date=2026-10-22&EndDate=invalid', '?Date=2026-10-22&Date=2026-10-23']) {
            assert.equal((await send(query)).status, 400);
        }
        for (const sub of [null, 'invalid']) {
            const invalid = await send(undefined, 'MANAGER', sub);
            assert.equal(invalid.status, 403);
            assert.deepEqual(await invalid.json(), { message: 'User ID not found in token.' });
        }
        assert.equal(calls.length, 0);
        user = null;
        const missing = await send('');
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'User not found' });
        for (const dbUser of [{ Role: 'MANAGER', IdStore: otherStore }, { Role: 'STORESTAFF', IdStore: storeId }, { Role: 'ADMIN', IdStore: storeId }]) {
            reset(); user = dbUser;
            const denied = await send('', dbUser.Role);
            assert.equal(denied.status, 403);
            assert.deepEqual(await denied.json(), { message: 'User does not have permission' });
            assert.deepEqual(calls.map(c => c.kind), ['user']);
        }
        reset();
        for (const [query, message] of [['', 'Date is required'],
            ['?Date=2026-10-22&EndDate=2026-10-21', 'EndDate must be greater than or equal to Date'],
            ['?Date=2026-10-22T12:00:00&EndDate=2026-10-22T09:00:00', 'EndDate must be greater than or equal to Date']]) {
            calls.length = 0;
            const invalid = await send(query);
            assert.equal(invalid.status, 400);
            assert.deepEqual(await invalid.json(), { message });
            assert.deepEqual(calls.map(c => c.kind), ['user']);
        }
        reset();
        const success = await send('?Date=2026-10-22T08:30:00&EndDate=2026-10-24T17:00:00');
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), {
            status: 0, data: {
                summary: { saleDate: '2026-10-22T00:00:00.000Z', totalRevenue: 0.3, totalCost: 0.35, totalProfit: -0.05 },
                items: [
                    { storeId, saleDate: '2026-10-22T09:15:00.000Z', productId: 'product-a', productName: 'Bread', totalQuantitySold: 1, totalRevenue: 0.1, totalCost: 0.05, profit: 0.05 },
                    { storeId, saleDate: '2026-10-22T10:30:00.000Z', productId: 'product-b', productName: 'Cake', totalQuantitySold: 2, totalRevenue: 0.2, totalCost: 0.3, profit: -0.1 }
                ]
            }, message: 'Get store revenue successfully'
        });
        assert.deepEqual(calls.map(c => c.kind), ['user', 'revenue']);
        assert.deepEqual(calls[1].params, { storeId, fromDate: new Date('2026-10-22T00:00:00Z'), toDate: new Date('2026-10-25T00:00:00Z') });
        for (const [query, from, to] of [
            ['?date=2026-10-22', '2026-10-22', '2026-10-23'],
            ['?DATE=2026-12-31&ENDDATE=2026-12-31', '2026-12-31', '2027-01-01'],
            ['?date=2024-02-29', '2024-02-29', '2024-03-01']
        ]) {
            reset(); rows = [];
            const empty = await send(query);
            assert.equal(empty.status, 200);
            assert.deepEqual((await empty.json()).data, {
                summary: { saleDate: `${from}T00:00:00.000Z`, totalRevenue: 0, totalCost: 0, totalProfit: 0 }, items: []
            });
            assert.equal(calls[1].params.toDate.toISOString(), `${to}T00:00:00.000Z`);
        }
        for (const stage of ['user', 'revenue']) {
            reset(); failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
        }
    } finally {
        db.queryOne = originals.queryOne; db.query = originals.query;
        await new Promise(resolve => server.close(resolve));
    }
});
