const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { StoreService } = require('../dist/services/store.service');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('store creation matches C# route, initial order and failure responses', async () => {
    const originalCreate = StoreService.create;
    const originalExecute = db.execute;
    const originalQueryOne = db.queryOne;
    const calls = [];
    StoreService.create = async dto => {
        calls.push({ store: dto });
        if (dto.StoreName === 'Store failure') throw new Error('Store insert failed');
        return { StoreId: 'store-id' };
    };
    db.execute = async (sql, params) => {
        calls.push({ sql, params });
        return { rowsAffected: [1] };
    };
    db.queryOne = async () => ({ OrderId: 'order-id' });
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body) => fetch(base + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    try {
        for (const path of ['/api/Stores', '/api/store']) {
            calls.length = 0;
            const response = await post(path, { StoreName: 'New store', Address: 'Address' });
            assert.equal(response.status, 200);
            assert.equal(await response.json(), 'Create store and initial order successfully');
            assert.deepEqual(calls[0], { store: { StoreName: 'New store', Address: 'Address' } });
            assert.equal(calls.length, 2);
            assert.match(calls[1].sql, /INSERT INTO Orders/);
            assert.deepEqual({ ...calls[1].params, orderId: undefined }, {
                orderId: undefined, userId: null, storeId: 'store-id', status: 'Creating', type: 'Normal', note: ''
            });
            assert.match(calls[1].params.orderId, /^[0-9a-f-]{36}$/);
            assert.match(calls[1].sql, /0, @status, @type, @note, NULL/);
        }
        calls.length = 0;
        const invalid = await post('/api/Stores', {});
        assert.equal(invalid.status, 400);
        assert.equal(calls.length, 0);
        const failedStore = await post('/api/Stores', { storeName: 'Store failure' });
        assert.equal(failedStore.status, 400);
        assert.equal(await failedStore.json(), 'Store insert failed');
        assert.equal(calls.length, 1);
        db.execute = async () => { throw new Error('Order insert failed'); };
        const failedOrder = await post('/api/Stores', { storeName: 'New store' });
        assert.equal(failedOrder.status, 400);
        assert.equal(await failedOrder.json(), 'Order insert failed');
    } finally {
        StoreService.create = originalCreate;
        db.execute = originalExecute;
        db.queryOne = originalQueryOne;
        await new Promise(resolve => server.close(resolve));
    }
});
