// Cache of successful public API responses. No auth/admin/teacher data enters it.
let memory=new Map(),dbPromise;
const publicPath=path=>/^\/api\/(info|groups|rooms|teachers|schedule(?:\/day)?|bells(?:\/config)?)(?:\?|$)/.test(path);
function open(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('MelmkPublicApi',1);r.onupgradeneeded=()=>r.result.createObjectStore('responses',{keyPath:'path'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return dbPromise;}
export async function readSnapshot(path){if(!publicPath(path))return null;if(memory.has(path))return memory.get(path);try{const db=await open();const entry=await new Promise((resolve,reject)=>{const r=db.transaction('responses').objectStore('responses').get(path);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});if(entry)memory.set(path,entry);return entry;}catch{return null;}}
export async function writeSnapshot(path,data){if(!publicPath(path)||data===null||typeof data!=='object')return;const entry={path,data,at:new Date().toISOString()};memory.set(path,entry);try{const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('responses','readwrite');tx.objectStore('responses').put(entry);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){console.warn('API snapshot',e);}return entry;}
export async function allSnapshots(){try{const db=await open();const entries=await new Promise((resolve,reject)=>{const r=db.transaction('responses').objectStore('responses').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});for(const e of entries)memory.set(e.path,e);}catch{}return [...memory.values()];}
export { publicPath };

export function validSnapshot(path,data){
 if(!data || typeof data!=='object')return false;
 const route=path.split('?')[0];
 const field={'/api/groups':'groups','/api/rooms':'rooms','/api/teachers':'teachers','/api/schedule':'days','/api/schedule/day':'pairs','/api/bells':'pairs','/api/bells/config':'regular'}[route];
 if(field)return Array.isArray(data[field]);
 return route==='/api/info' && ['green','red'].includes(data.week);
}
