const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('ingredient creation and reads match C# fields, casing, empty values, Location and public access', async () => {
    const originals = { query: db.query, queryOne: db.queryOne, execute: db.execute };
    const id = '00000000-0000-0000-0000-000000000001';
    let ingredient = { IngredientId: id, IngredientName: 'Flour', Unit: 'kg' };
    let rows = [ingredient], failure = '';
    const calls = [];
    db.query = async sql => {
        calls.push('list'); assert.equal(sql, 'SELECT IngredientId, IngredientName, Unit FROM Ingredients');
        if (failure === 'list') throw new Error('Read failed'); return rows;
    };
    db.queryOne = async (sql, params) => {
        calls.push('get'); assert.equal(sql, 'SELECT IngredientId, IngredientName, Unit FROM Ingredients WHERE IngredientId = @id');
        assert.deepEqual(params, { id }); if (failure === 'get') throw new Error('Read failed'); return ingredient;
    };
    db.execute = async (sql, params) => {
        calls.push({ kind: 'create', params });
        assert.match(sql, /INSERT INTO Ingredients \(IngredientId, IngredientName, Unit\)/);
        assert.doesNotMatch(sql, /Status/);
        if (failure === 'create') throw new Error('Insert failed'); return { rowsAffected: [1] };
    };
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/ingredient`;
    const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const entity = (ingredientId, ingredientName, unit) => ({ ingredientId, ingredientName, unit, recipeIngredients: [], cookingIngredientHistories: [] });
    try {
        for (const body of [{}, [], { ingredientName: 'Flour' }, { ingredientName: null, unit: 'kg' }, { ingredientName: 'Flour', unit: 123 }]) {
            assert.equal((await post(body)).status, 400);
        }
        assert.equal((await fetch(`${url}/invalid`)).status, 404); assert.equal(calls.length, 0);
        for (const [body, name, unit] of [
            [{ ingredientName: 'Sugar', unit: 'g', status: 'Blocked' }, 'Sugar', 'g'],
            [{ IngredientName: 'Salt', Unit: 'kg', Status: 'Blocked' }, 'Salt', 'kg'],
            [{ INGREDIENTNAME: '', UNIT: '' }, '', '']
        ]) {
            const success = await post(body); assert.equal(success.status, 201);
            const created = await success.json(); assert.match(created.ingredientId, /^[0-9a-f-]{36}$/);
            assert.deepEqual(created, entity(created.ingredientId, name, unit));
            assert.equal(success.headers.get('location'), `/api/ingredient/${created.ingredientId}`);
            assert.deepEqual(calls.at(-1).params, { id: created.ingredientId, name, unit });
        }
        const list = await fetch(url); assert.equal(list.status, 200); assert.deepEqual(await list.json(), [entity(id, 'Flour', 'kg')]);
        const single = await fetch(`${url}/${id}`); assert.equal(single.status, 200); assert.deepEqual(await single.json(), entity(id, 'Flour', 'kg'));
        rows = []; ingredient = null;
        const empty = await fetch(url); assert.equal(empty.status, 200); assert.deepEqual(await empty.json(), []);
        const missing = await fetch(`${url}/${id}`); assert.equal(missing.status, 404); assert.equal(await missing.text(), '');
        for (const stage of ['list', 'get', 'create']) {
            failure = stage;
            const failed = stage === 'create' ? await post({ ingredientName: 'Flour', unit: 'kg' }) : await fetch(stage === 'list' ? url : `${url}/${id}`);
            assert.equal(failed.status, 500); assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
        }
    } finally {
        db.query = originals.query; db.queryOne = originals.queryOne; db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
