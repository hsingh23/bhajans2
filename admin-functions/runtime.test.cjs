const { test } = require('node:test');
const assert = require('node:assert/strict');
const handlers = require('./index.cjs');

for (const name of ['getUserByEmail', 'updateUserAccess']) {
  test(`${name} deploys with the Firebase database-authorized identity`, () => {
    assert.equal(
      handlers[name].__endpoint.serviceAccountEmail,
      'bhajans-588f5@appspot.gserviceaccount.com',
      'Generation 2 defaults to the Compute identity, which cannot access this database',
    );
  });
}
