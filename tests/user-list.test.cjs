const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('user list matches C# DTO, ADMIN/MANAGER access, blocked users and empty results', async () => {
    const originalQuery = db.query;
    const profile = {
        Id: 'user-a', Gmail: 'user@example.com', Name: 'User', Gender: 'Other',
        DateOfBirth: new Date('2000-01-01T00:00:00Z'), Address: 'Address',
        PhoneNumber: '0123456789', Role: 'STORESTAFF', IdStore: null, Avatar: null, Status: 'Active'
    };
    let rows = [profile, { ...profile, Id: 'user-b', Status: 'Blocked' }];
    let reads = 0, failure = false;
    db.query = async sql => {
        reads++;
        assert.match(sql, /FROM Users$/);
        assert.doesNotMatch(sql, /Password|WHERE|JOIN/i);
        if (failure) throw new Error('Read failed');
        return rows;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (role = 'ADMIN') => {
        const token = jwt.sign({ sub: 'admin', role }, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience
        });
        return fetch(`http://127.0.0.1:${server.address().port}/api/users`, {
            headers: role ? { Authorization: `Bearer ${token}` } : {}
        });
    };
    try {
        assert.equal((await send(null)).status, 401);
        for (const role of ['STORESTAFF', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send(role)).status, 403);
        }
        assert.equal(reads, 0);
        const expected = {
            id: 'user-a', gmail: 'user@example.com', name: 'User', gender: 'Other', dateOfBirth: '2000-01-01T00:00:00.000Z',
            address: 'Address', phoneNumber: '0123456789', role: 'STORESTAFF', idStore: null, avatar: null, status: 'Active'
        };
        for (const role of ['ADMIN', 'MANAGER']) {
            const response = await send(role);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), [expected, { ...expected, id: 'user-b', status: 'Blocked' }]);
        }
        rows = [];
        const empty = await send();
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), []);
        failure = true;
        const failed = await send();
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
    } finally {
        db.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
