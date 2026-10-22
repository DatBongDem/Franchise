const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('start cooking matches C# transitions, batch validation, histories, timestamps and errors', async () => {
    const originals = { query: db.query, queryOne: db.queryOne, execute: db.execute, now: Date.now };
    const orderId = '00000000-0000-0000-0000-000000000001';
    const userId = '00000000-0000-0000-0000-000000000002';
    let order, batches, missingIngredient, noRecipe, noIngredients, failure;
    const calls = [];
    const reset = () => {
        order = { OrderId: orderId, Status: 'WaitingForCooking' };
        batches = [
            { BatchId: 'batch-a', ProductId: 'product-a', Status: 'WaitingForCooking', QualityOrder: 4 },
            { BatchId: 'batch-b', ProductId: 'product-b', Status: 'Cooked', QualityOrder: 2 }
        ];
        missingIngredient = false; noRecipe = false; noIngredients = false; failure = '';
        calls.length = 0;
    };
    const record = (kind, data) => {
        calls.push({ kind, ...data });
        if (failure === kind) throw new Error('Database unavailable');
    };
    Date.now = () => Date.parse('2026-10-22T20:30:00Z');
    db.queryOne = async (sql, params) => {
        if (sql.includes('FROM Orders')) { record('order-read', { params }); return order; }
        record('recipe-read', { params });
        return noRecipe ? null : { RecipeID: `recipe-${params.prodId}` };
    };
    db.query = async (sql, params) => {
        if (sql.includes('FROM ProductBatches')) { record('batch-read', { params }); return batches; }
        record('ingredient-read', { sql, params });
        assert.match(sql, /LEFT JOIN Ingredients/);
        return noIngredients ? [] : [{
            IngredientId: 'ingredient', ExistingIngredientId: missingIngredient && params.recipeId === 'recipe-product-b' ? null : 'ingredient',
            Quantity: 1.25, Unit: 'kg'
        }];
    };
    db.execute = async (sql, params) => {
        const kind = sql.includes('UPDATE Orders') ? 'order-write'
            : sql.includes('UPDATE ProductBatches') ? 'batch-write' : 'history-write';
        record(kind, { sql, params });
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'KITCHENSTAFF', id = orderId, sub = userId) => {
        const claims = { role, ...(sub == null ? {} : { sub }) };
        const token = jwt.sign(claims, config.jwt.secret, { issuer: config.jwt.issuer, audience: config.jwt.audience });
        return fetch(`http://127.0.0.1:${server.address().port}/api/order/${id}/start-cooking`, {
            method: 'PUT', headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        reset();
        assert.equal((await send(null)).status, 401);
        for (const role of ['ADMIN', 'MANAGER', 'STORESTAFF', 'SUPPLYCOORDINATOR']) assert.equal((await send(role)).status, 403);
        assert.equal((await send('KITCHENSTAFF', 'invalid')).status, 400);
        const missingUser = await send('KITCHENSTAFF', orderId, null);
        assert.equal(missingUser.status, 401);
        assert.equal(await missingUser.json(), 'User ID not found in token.');
        assert.equal((await send('KITCHENSTAFF', orderId, 'invalid')).status, 500);
        assert.equal(calls.length, 0);

        const success = await send();
        assert.equal(success.status, 200);
        assert.deepEqual(await success.json(), { message: 'Order has started cooking and ingredient history has been recorded.' });
        const orderWrite = calls.find(c => c.kind === 'order-write');
        assert.deepEqual(orderWrite.params, { orderId, status: 'Cooking', now: new Date('2026-10-23T03:30:00Z') });
        assert.deepEqual(calls.filter(c => c.kind === 'batch-write').map(c => c.params), [{ batchId: 'batch-a', status: 'Cooking' }]);
        const historyWrite = calls.find(c => c.kind === 'history-write');
        assert.match(historyWrite.sql, /FROM OPENJSON\(@histories\)/);
        const histories = JSON.parse(historyWrite.params.histories);
        assert.equal(histories.length, 2);
        assert.deepEqual(histories.map(h => ({ ...h, id: undefined })), [
            { id: undefined, batchId: 'batch-a', ingredientId: 'ingredient', quantityUsed: 5, unit: 'kg', createdTime: '2026-10-22T20:30:00.000Z' },
            { id: undefined, batchId: 'batch-b', ingredientId: 'ingredient', quantityUsed: 2.5, unit: 'kg', createdTime: '2026-10-22T20:30:00.000Z' }
        ]);
        assert.notEqual(histories[0].id, histories[1].id);
        assert.equal(calls.at(-1).kind, 'history-write');

        reset(); order.Status = 'Cooking';
        assert.equal((await send()).status, 200);
        assert.equal(calls.some(c => c.kind === 'order-write'), false);
        assert.equal(calls.filter(c => c.kind === 'history-write').length, 1);
        reset(); order = null;
        const missingOrder = await send();
        assert.equal(missingOrder.status, 404);
        assert.deepEqual(await missingOrder.json(), { message: 'Order not found.' });
        assert.deepEqual(calls.map(c => c.kind), ['order-read']);
        for (const status of ['Creating', 'Pending', 'PickedUp', 'Cooked', 'TakenFrom', 'Arrived', 'Completed', 'Canceled']) {
            reset(); order.Status = status;
            const invalid = await send();
            assert.equal(invalid.status, 400);
            assert.deepEqual(await invalid.json(), { message: 'Order is not in cooking status.' });
            assert.equal(calls.length, 1);
        }
        reset(); batches = [];
        const empty = await send();
        assert.equal(empty.status, 400);
        assert.deepEqual(await empty.json(), { message: 'Order has no product batches.' });
        assert.deepEqual(calls.map(c => c.kind), ['order-read', 'order-write', 'batch-read']);
        for (const skip of ['noRecipe', 'noIngredients']) {
            reset(); noRecipe = skip === 'noRecipe'; noIngredients = skip === 'noIngredients';
            assert.equal((await send()).status, 200);
            assert.equal(calls.some(c => c.kind === 'history-write'), false);
        }
        reset(); missingIngredient = true;
        const integrityError = await send();
        assert.equal(integrityError.status, 400);
        assert.deepEqual(await integrityError.json(), {
            message: "Data integrity issue: Ingredient with ID 'ingredient' referenced in Recipe with ID 'recipe-product-b' does not exist."
        });
        assert.equal(calls.some(c => c.kind === 'history-write'), false);
        for (const stage of ['order-read', 'order-write', 'batch-read', 'batch-write', 'recipe-read', 'ingredient-read', 'history-write']) {
            reset(); failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An error occurred while starting to cook the order.', error: 'Database unavailable' });
        }
    } finally {
        db.query = originals.query; db.queryOne = originals.queryOne; db.execute = originals.execute; Date.now = originals.now;
        await new Promise(resolve => server.close(resolve));
    }
});
