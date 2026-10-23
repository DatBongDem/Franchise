const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('user status toggle matches C# messages, transitions, ADMIN access and missing users', async () => {
    const originals = { queryOne: db.queryOne, execute: db.execute };
    const id = '00000000-0000-0000-0000-000000000001';
    let user = { Id: id, Status: 'Active' };
    let failure = '';
    let reads = 0;
    const writes = [];
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        if (failure === 'read') throw new Error('Read failed');
        return user;
    };
    db.execute = async (sql, params) => {
        if (failure === 'write') throw new Error('Write failed');
        assert.equal(sql, 'UPDATE Users SET Status = @status WHERE Id = @id');
        writes.push(params);
        user = { ...user, Status: params.status };
        return { rowsAffected: [1] };
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'ADMIN', userId = id) => {
        const token = jwt.sign({ sub: 'admin-user', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/users/${userId}/toggle-status`, {
            method: 'PUT', headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send(null)).status, 401);
        for (const role of ['MANAGER', 'STORESTAFF', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send(role)).status, 403);
        }
        assert.equal((await send('ADMIN', 'invalid')).status, 404);
        assert.equal(reads, 0);
        assert.equal(writes.length, 0);
        for (const [status, message] of [
            ['Blocked', 'Account has been blocked.'], ['Active', 'Account has been recovered.']
        ]) {
            const response = await send();
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { message, status });
            assert.deepEqual(writes.at(-1), { id, status });
        }
        user = { Id: id, Status: 'Other' };
        const recovered = await send();
        assert.equal(recovered.status, 200);
        assert.deepEqual(await recovered.json(), { message: 'Account has been recovered.', status: 'Active' });
        const count = writes.length;
        user = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.equal(await missing.text(), '');
        assert.equal(writes.length, count);
        user = { Id: id, Status: 'Active' };
        for (const stage of ['read', 'write']) {
            failure = stage;
            const failed = await send();
            assert.equal(failed.status, 500);
            assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
        }
    } finally {
        db.queryOne = originals.queryOne;
        db.execute = originals.execute;
        await new Promise(resolve => server.close(resolve));
    }
});
