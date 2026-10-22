const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('quantitative update matches C# validation, token store and update-only behavior', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const storeId = '00000000-0000-0000-0000-000000000001';
    const productId = '00000000-0000-0000-0000-000000000002';
    const otherStore = '00000000-0000-0000-0000-000000000003';
    let existing = true;
    let failure = '';
    const reads = [], writes = [];
    db.queryOne = async (sql, params) => {
        reads.push(params);
        if (failure === 'read') throw new Error('Read failed');
        return existing ? { StoreId: storeId, ProductId: productId, Quantity: 5 } : null;
    };
    db.execute = async (sql, params) => {
        if (failure === 'write') throw new Error('Write failed');
        writes.push({ sql, params });
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (body, tokenStore = storeId, role = 'STORESTAFF', id = productId) => {
        const token = jwt.sign({ sub: 'user', role, IdStore: tokenStore }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/quantitative/${id}?storeId=${otherStore}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(body)
        });
    };
    try {
        assert.equal((await send({ quantity: 1 }, storeId, null)).status, 401);
        assert.equal((await send({ quantity: 1 }, storeId, 'STORESTAFF', 'invalid')).status, 400);
        for (const body of [{}, { quantity: null }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 },
            { quantity: 2147483648 }, { quantity: '2abc' }, { quantity: true }, { quantity: {} }, { quantity: '' }]) {
            assert.equal((await send(body)).status, 400);
        }
        for (const invalidStore of [null, '', 'invalid']) {
            const response = await send({ quantity: 1, storeId: otherStore }, invalidStore);
            assert.equal(response.status, 401);
            assert.deepEqual(await response.json(), { message: 'Store ID not found or invalid in token.' });
        }
        assert.equal(reads.length, 0);
        assert.equal(writes.length, 0);

        for (const [body, quantity] of [[{ quantity: 1 }, 1], [{ Quantity: 2147483647 }, 2147483647], [{ quantity: '12' }, 12]]) {
            const response = await send({ ...body, storeId: otherStore });
            assert.equal(response.status, 204);
            assert.equal(await response.text(), '');
            assert.deepEqual(reads.at(-1), { storeId, productId });
            assert.deepEqual(writes.at(-1).params, { storeId, productId, quantity });
            assert.match(writes.at(-1).sql, /^UPDATE Quantitatives SET Quantity/);
            assert.doesNotMatch(writes.at(-1).sql, /INSERT/);
        }
        const before = writes.length;
        existing = false;
        const missing = await send({ quantity: 10 });
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'Quantitative rule not found for the specified product and store.' });
        assert.equal(writes.length, before);
        existing = true;
        // C# applies authentication without restricting the role.
        for (const role of ['ADMIN', 'MANAGER', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send({ quantity: 2 }, storeId, role)).status, 204);
        }
        for (const stage of ['read', 'write']) {
            failure = stage;
            const failed = await send({ quantity: 10 });
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An unexpected error occurred.', details: stage === 'read' ? 'Read failed' : 'Write failed' });
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
