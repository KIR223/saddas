// Audit is written transactionally by the server, never by this browser.
export function pushAudit() {}
export function loadAudit() { return []; }
export function clearAudit() {}
