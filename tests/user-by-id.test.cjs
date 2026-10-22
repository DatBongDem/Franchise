const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('user by ID matches C# DTO, ADMIN/MANAGER access, GUID route and missing records', async () => {
    const originalQueryOne = db.queryOne;
    const id = '00000000-0000-0000-0000-000000000001';
    let profile = {
        Id: id, Gmail: 'user@example.com', Name: 'User', Gender: 'Other',
        DateOfBirth: new Date('2000-01-01T00:00:00Z'), Address: 'Address',
        PhoneNumber: '0123456789', Role: 'STORESTAFF', IdStore: null, Avatar: null, Status: 'Blocked'
    };
    let reads = 0, failure = false;
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        assert.match(sql, /FROM Users WHERE Id = @id/);
        assert.doesNotMatch(sql, /Password/);
        if (failure) throw new Error('Read failed');
        return profile;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'ADMIN', userId = id) => {
        const token = jwt.sign({ sub: 'different-user', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/users/${userId}`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send(null)).status, 401);
        for (const role of ['STORESTAFF', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send(role)).status, 403);
        }
        assert.equal((await send('ADMIN', 'invalid')).status, 404);
        assert.equal(reads, 0);
        for (const role of ['ADMIN', 'MANAGER']) {
            const response = await send(role);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                id, gmail: 'user@example.com', name: 'User', gender: 'Other', dateOfBirth: '2000-01-01T00:00:00.000Z',
                address: 'Address', phoneNumber: '0123456789', role: 'STORESTAFF', idStore: null, avatar: null, status: 'Blocked'
            });
        }
        profile = null;
        const missing = await send();
        assert.equal(missing.status, 404);
        assert.equal(await missing.text(), '');
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
    } finally {
        db.queryOne = originalQueryOne;
        await new Promise(resolve => server.close(resolve));
    }
});
