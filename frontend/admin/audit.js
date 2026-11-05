import { request } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
export async function renderAudit(root) {
 clear(root);root.append(el('p','','Загрузка журнала…'));
 try {const out=await request('/api/admin/audit');clear(root);root.append(el('h2','','Журнал изменений сервера'));for(const e of out.events)root.append(el('p','',`${e.at} · ${e.actor_login} · ${e.action} · ${e.entity}`));if(!out.events.length)root.append(el('p','','Изменений пока нет'));}
 catch(e){clear(root);root.append(el('p','',e.message));}
}
