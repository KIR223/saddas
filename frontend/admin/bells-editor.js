import { request } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
export async function renderServerBells(root) {
 clear(root);root.append(el('h2','','Звонки колледжа'));
 try {
 let cfg=await request('/api/admin/bell-config');const form=el('form'),report=el('p');root.append(form,report);
 const fields={};
 function slotsCard(title,slots,key){const card=el('fieldset','adm-card');card.append(el('legend','',title));const rows=[];
 for(let pair=1;pair<=12;pair++){const row=el('div','field'),label=el('label','',`Пара ${pair}`),start=el('input'),end=el('input');start.type=end.type='time';start.setAttribute('aria-label',`Начало пары ${pair}`);end.setAttribute('aria-label',`Конец пары ${pair}`);const slot=slots.find(s=>s.pair===pair);start.value=slot?.start||'';end.value=slot?.end||'';row.append(label,start,end);card.append(row);rows.push({pair,start,end});}fields[key]=rows;return card;}
 for(const [key,title] of [['regular','Обычный день'],['monThu','Понедельник'],['thursday','Четверг'],['shortDay','Сокращённый шаблон']]) form.append(slotsCard(title,cfg[key],key));
 const curators=el('fieldset','adm-card');curators.append(el('legend','','Кураторские часы'));const curatorInputs=[];
 for(const day of [1,4]){const item=cfg.curators.find(c=>c.day===day)||{day,enabled:false,start:'08:00',end:'08:40',title:'Кураторский час'};const row=el('div','field'),enabled=el('input'),start=el('input'),end=el('input'),title=el('input');enabled.type='checkbox';enabled.checked=item.enabled;start.type=end.type='time';start.value=item.start;end.value=item.end;title.value=item.title;row.append(el('label','',day===1?'Понедельник':'Четверг'),enabled,start,end,title);curators.append(row);curatorInputs.push({day,enabled,start,end,title});}form.append(curators);
 const exceptions=el('fieldset','adm-card');exceptions.append(el('legend','','Исключения по датам'));const date=el('input');date.type='date';const add=el('button','btn','Добавить сокращённую дату');add.type='button';exceptions.append(date,add);form.append(exceptions);
 function addDate(d,slots){if(fields['date:'+d])return;const card=slotsCard(d,slots,'date:'+d),del=el('button','btn','Убрать исключение');del.type='button';del.onclick=()=>{delete fields['date:'+d];card.remove();};card.append(del);exceptions.append(card);}
 for(const [d,slots] of Object.entries(cfg.exceptions))addDate(d,slots);add.onclick=()=>{if(date.value)addDate(date.value,cfg.shortDay);};
 const submit=el('button','btn btn--primary','Сохранить звонки на сервере');submit.type='submit';form.append(submit);
 const read=rows=>rows.filter(r=>r.start.value||r.end.value).map(r=>({pair:r.pair,start:r.start.value,end:r.end.value}));
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;report.textContent='Сохранение…';try{const body={curators:curatorInputs.map(c=>({day:c.day,enabled:c.enabled.checked,start:c.start.value,end:c.end.value,title:c.title.value})),exceptions:{}};for(const [k,rows] of Object.entries(fields)){if(k.startsWith('date:'))body.exceptions[k.slice(5)]=read(rows);else body[k]=read(rows);}cfg=await request('/api/admin/bell-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});report.textContent='Сохранено. Данные доступны всем устройствам.';}catch(e){report.textContent=e.message;}finally{submit.disabled=false;}};
 }catch(e){root.append(el('p','',e.message));}
}
