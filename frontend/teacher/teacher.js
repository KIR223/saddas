import { request } from '../js/api/client.js';
import { refreshSession, logout } from '../js/utils/auth.js';
import { el, clear } from '../js/utils/dom.js';
const user=await refreshSession();
if(!user) location.replace('/admin/');
else if(user.role==='admin') location.replace('/admin/');
else {
 document.getElementById('identity').textContent=user.teacher_name||user.login;
 const date=document.getElementById('date'),period=document.getElementById('period'),root=document.getElementById('schedule');
 date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 async function render(){clear(root);root.append(el('p','','Загрузка…'));try{const out=await request(`/api/teacher/schedule?${new URLSearchParams({date:date.value,days:period.value})}`);clear(root);for(const day of out.days){root.append(el('h2','',day.date));if(!day.pairs.length)root.append(el('p','','Пар нет'));for(const p of day.pairs)root.append(el('p','',`${p.pair}. ${p.start||'—'}–${p.end||'—'} · ${p.group} · ${p.subject} · ${p.room}`));}}catch(e){clear(root);root.append(el('p','',e.message));}}
 date.onchange=period.onchange=render;
 document.getElementById('logout').onclick=async()=>{await logout();location.replace('/admin/');};
 await render();
}
