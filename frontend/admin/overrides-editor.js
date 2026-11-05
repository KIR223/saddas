import { request, fetchGroups } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
export async function renderOverrides(root) {
 clear(root);root.append(el('h2','','Замены на даты'));
 try {
 const {groups}=await fetchGroups();if(!groups.length){root.append(el('p','','Сначала создайте группу'));return;}
 const form=el('form','adm-card'),group=el('select'),pair=el('input'),weekday=el('select'),from=el('input'),to=el('input'),cancelled=el('input'),subject=el('input'),teacher=el('input'),room=el('input');
 for(const name of groups){const o=el('option','',name);o.value=name;group.append(o);}
 pair.type='number';pair.min='1';pair.max='12';pair.value='1';pair.required=true;from.type=to.type='date';cancelled.type='checkbox';
 ['Любой день','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].forEach((d,i)=>{const o=el('option','',d);o.value=i?String(i):'';weekday.append(o);});
 for(const [label,input] of [['Группа',group],['Номер пары',pair],['День недели',weekday],['С даты',from],['По дату',to],['Отмена пары',cancelled],['Предмет',subject],['Преподаватель',teacher],['Кабинет',room]]){const field=el('label','field',label);field.append(input);form.append(field);}
 form.append(el('p','','Без дат: ближайшие 16 недель выбранного дня. С датами: до 120 дней.'));
 const save=el('button','btn btn--primary','Записать весь диапазон'),remove=el('button','btn','Снять замены диапазона');save.type='submit';remove.type='button';form.append(save,remove);const report=el('p'),list=el('div');root.append(form,report,list);
 async function load(){clear(list);const out=await request(`/api/admin/overrides?${new URLSearchParams({group:group.value})}`);for(const s of out.overrides){const card=el('div','adm-card');card.append(el('p','',`${s.on_date} · пара ${s.pair} · ${s.cancelled?'Отменена':s.subject+' · '+s.teacher+' · '+s.room}`));const del=el('button','btn','Вернуть шаблон на эту дату');del.onclick=async()=>{try{await request('/api/admin/overrides/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:group.value,pair:s.pair,date_from:s.on_date,date_to:s.on_date,operation:'remove'})});await load();}catch(e){report.textContent=e.message;}};card.append(del);list.append(card);}}
 async function apply(operation){save.disabled=remove.disabled=true;try{const body={group:group.value,pair:Number(pair.value),weekday:weekday.value?Number(weekday.value):null,date_from:from.value||null,date_to:to.value||null,cancelled:cancelled.checked,subject:subject.value,teacher:teacher.value,room:room.value,operation};if(!from.value&&!to.value&&!weekday.value)throw new Error('Выберите день недели для 16 недель');const out=await request('/api/admin/overrides/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});report.textContent=`Готово для ${out.count} дат: ${out.dates.join(', ')}`;await load();}catch(e){report.textContent=e.message;}finally{save.disabled=remove.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();apply('set');};remove.onclick=()=>apply('remove');group.onchange=()=>load().catch(e=>report.textContent=e.message);await load();
 }catch(e){root.append(el('p','',e.message));}
}
