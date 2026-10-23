const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const db = require('../dist/config/db');
const routes = require('../dist/routes').default;

test('current user matches C# DTO, verified ID claims, validation and errors', async () => {
    const originalQueryOne = db.queryOne;
    const id = '00000000-0000-0000-0000-000000000001';
    const profile = {
        Id: id, Gmail: 'user@example.com', Name: 'User', Gender: 'Other',
        DateOfBirth: new Date('2000-01-01T00:00:00Z'), Address: 'Address',
        PhoneNumber: '0123456789', Role: 'STORESTAFF', IdStore: null, Avatar: null, Status: 'Active'
    };
    let existing = true, failure = false, reads = 0;
    db.queryOne = async (sql, params) => {
        reads++;
        assert.deepEqual(params, { id });
        assert.match(sql, /FROM Users WHERE Id = @id/);
        assert.doesNotMatch(sql, /Password/);
        if (failure) throw new Error('Read failed');
        return existing ? profile : null;
    };
    const app = express();
    app.use('/api', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const sign = claims => jwt.sign(claims, config.jwt.secret, { issuer: config.jwt.issuer, audience: config.jwt.audience });
    const send = token => fetch(`http://127.0.0.1:${server.address().port}/api/users/me?id=other-user`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    try {
        assert.equal((await send()).status, 401);
        assert.equal((await send('invalid-token')).status, 401);
        for (const claims of [{}, { sub: 'invalid' }, { id: 123 }]) {
            const invalid = await send(sign(claims));
            assert.equal(invalid.status, 401);
            assert.deepEqual(await invalid.json(), { message: 'User ID not found in token.' });
        }
        assert.equal(reads, 0);
        for (const claim of ['sub', 'id', 'nameid', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']) {
            const success = await send(sign({ [claim]: id, role: 'STORESTAFF' }));
            assert.equal(success.status, 200);
            assert.deepEqual(await success.json(), {
                id, gmail: 'user@example.com', name: 'User', gender: 'Other', dateOfBirth: '2000-01-01T00:00:00.000Z',
                address: 'Address', phoneNumber: '0123456789', role: 'STORESTAFF', idStore: null, avatar: null, status: 'Active'
            });
        }
        for (const role of ['ADMIN', 'MANAGER', 'KITCHENSTAFF', 'SUPPLYCOORDINATOR']) {
            assert.equal((await send(sign({ sub: id, role }))).status, 200);
        }
        existing = false;
        const missing = await send(sign({ sub: id }));
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { message: 'User not found.' });
        failure = true;
        const failed = await send(sign({ sub: id }));
        assert.equal(failed.status, 500);
        assert.deepEqual(await failed.json(), { message: 'An internal error occurred.' });
    } finally {
        db.queryOne = originalQueryOne;
        await new Promise(resolve => server.close(resolve));
    }
});
