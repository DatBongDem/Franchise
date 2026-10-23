const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('ingredient histories match C# order checks, DTO, pagination, auth and error handling', async () => {
    const originals = { queryOne: db.queryOne, query: db.query };
    const orderId = '00000000-0000-0000-0000-000000000001';
    const batchId = '00000000-0000-0000-0000-000000000002';
    const expected = [
        { ingredientId: 'ingredient-a', ingredientName: 'Flour', quantityUsed: 1.25, unit: 'kg' },
        { ingredientId: 'ingredient-b', ingredientName: 'N/A', quantityUsed: 0.5, unit: 'g' }
    ];
    let exists = true, batches = [{ BatchId: batchId }], rows, total = 25, failure = '';
    const calls = [];
    const resetRows = () => { rows = [
        { IngredientId: 'ingredient-a', IngredientName: 'Flour', QuantityUsed: 1.25, Unit: 'kg' },
        { IngredientId: 'ingredient-b', IngredientName: null, QuantityUsed: 0.5, Unit: 'g' }
    ]; };
    resetRows();
    const record = (kind, params) => {
        calls.push({ kind, params });
        if (failure === kind) throw new Error('Database unavailable');
    };
    db.queryOne = async (sql, params) => {
        if (sql.includes('FROM Orders')) {
            record('order', params); assert.deepEqual(params, { orderId });
            return exists ? { OrderId: orderId } : null;
        }
        record('count', params);
        assert.equal(sql, 'SELECT COUNT(*) AS count FROM CookingIngredientHistories');
        return { count: total };
    };
    db.query = async (sql, params) => {
        if (sql.startsWith('SELECT BatchId FROM ProductBatches')) {
            record('batches', params); assert.deepEqual(params, { orderId }); return batches;
        }
        assert.match(sql, /LEFT JOIN Ingredients/);
        assert.doesNotMatch(sql, /cih\.\*|ProductBatchBatchId/);
        if (sql.includes('OPENJSON')) {
            record('order-history', params);
            assert.deepEqual(JSON.parse(params.batchIds), [batchId]);
            assert.match(sql, /WHERE cih.BatchId IN/);
        } else {
            record('page', params);
            assert.match(sql, /ORDER BY cih.CreatedTime DESC/);
            assert.match(sql, /OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY/);
        }
        return rows;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const orderPath = `/api/ingredient/${orderId}/ingredients`;
    const pagePath = '/api/ingredient/ingredient-history';
    const send = (path, role = 'KITCHENSTAFF') => {
        const token = jwt.sign({ sub: 'kitchen-user', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        for (const path of [orderPath, pagePath]) {
            assert.equal((await send(path, null)).status, 401);
            for (const role of ['ADMIN', 'MANAGER', 'STORESTAFF', 'SUPPLYCOORDINATOR']) {
                assert.equal((await send(path, role)).status, 403);
            }
        }
        assert.equal((await send('/api/ingredient/invalid/ingredients')).status, 400);
        for (const query of ['pageNumber=2abc', 'pageSize=1.5', 'pageNumber=2147483648', 'pageSize=', 'pageSize=1&pageSize=2']) {
            assert.equal((await send(`${pagePath}?${query}`)).status, 400);
        }
        assert.equal(calls.length, 0);
        const success = await send(orderPath);
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), expected);
        assert.deepEqual(calls.map(c => c.kind), ['order', 'batches', 'order-history']);
        calls.length = 0; exists = false;
        const missing = await send(orderPath);
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'Order not found.' });
        assert.deepEqual(calls.map(c => c.kind), ['order']);
        exists = true; batches = []; calls.length = 0;
        const noBatches = await send(orderPath);
        assert.equal(noBatches.status, 200);
        assert.deepEqual(await noBatches.json(), []);
        assert.deepEqual(calls.map(c => c.kind), ['order', 'batches']);
        batches = [{ BatchId: batchId }]; rows = [];
        const noHistories = await send(orderPath);
        assert.equal(noHistories.status, 200);
        assert.deepEqual(await noHistories.json(), []);
        resetRows();
        for (const query of ['', '?pageNumber=2&pageSize=10', '?PageNumber=3&PageSize=10']) {
            calls.length = 0;
            const page = await send(pagePath + query);
            const pageNumber = query === '' ? 1 : query.includes('=2') ? 2 : 3;
            assert.equal(page.status, 200);
            assert.deepEqual(await page.json(), {
                status: 0, data: { items: expected, totalRecords: 25, pageNumber, pageSize: 10, totalPages: 3 },
                message: 'Get all cooking ingredient histories successfully.'
            });
            assert.deepEqual(calls.map(c => c.kind), ['count', 'page']);
            assert.deepEqual(calls[1].params, { offset: (pageNumber - 1) * 10, pageSize: 10 });
        }
        rows = []; total = 0;
        const emptyPage = await send(pagePath);
        assert.equal(emptyPage.status, 200);
        assert.deepEqual(await emptyPage.json(), {
            status: 0, data: { items: [], totalRecords: 0, pageNumber: 1, pageSize: 10, totalPages: 0 },
            message: 'No cooking ingredient histories found.'
        });
        for (const stage of ['order', 'batches', 'order-history']) {
            failure = stage;
            const failed = await send(orderPath);
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), {
                message: 'An error occurred while retrieving cooking ingredient history.',
                error: stage === 'order-history' ? 'An error occurred while fetching data from the database.' : 'Database unavailable'
            });
        }
        for (const stage of ['count', 'page']) {
            failure = stage;
            const failed = await send(pagePath);
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An internal error occurred.', error: 'Database unavailable' });
        }
    } finally {
        db.queryOne = originals.queryOne; db.query = originals.query;
        await new Promise(resolve => server.close(resolve));
    }
});
