// Replaces tests of the retired local editor with the server session boundary.
import assert from 'node:assert/strict';
import { request } from '../js/api/client.js';
let sent;
globalThis.fetch=async(url,options)=>{sent={url,options};return new Response(JSON.stringify({groups:['ТМ-999']}),{status:200});};
assert.deepEqual(await request('/api/groups'),{groups:['ТМ-999']});
assert.equal(sent.options.credentials,'include');
assert.equal(sent.options.headers['x-admin-token'],undefined);
globalThis.fetch=async()=>new Response(JSON.stringify({detail:'нужна роль admin'}),{status:403});
await assert.rejects(request('/api/admin/users'),/нужна роль admin/);
console.log('server session boundary: OK');
