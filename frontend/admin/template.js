import { request, fetchGroups } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
import { toast } from '../js/utils/toast.js';
export async function renderTemplate(root) {
 clear(root);root.append(el('h2','','Шаблон недели'));
 root.append(el('p','','Повторяется каждую неделю выбранного цвета. Для разовой замены используйте «Замены».'));
 try {
 const {groups}=await fetchGroups();if(!groups.length){root.append(el('p','','Сначала создайте группу в разделе «Группы».'));return;}
 const group=el('select'),day=el('select'),week=el('select');
 for(const g of groups){const o=el('option','',g);o.value=g;group.append(o);}
 ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].forEach((d,i)=>{const o=el('option','',d);o.value=String(i+1);day.append(o);});
 for(const [v,t] of [['green','Зелёная'],['red','Красная']]){const o=el('option','',t);o.value=v;week.append(o);}
 const form=el('form','adm-card');root.append(group,day,week,form);let version=0;
 const query=()=>new URLSearchParams({group:group.value,day:day.value,week:week.value});
 async function load(){const current=++version;clear(form);try{const data=await request(`/api/admin/template?${query()}`);if(current!==version)return;const fields=[];
 for(let n=1;n<=12;n++){const row=el('div','adm-card');row.append(el('label','',`Пара ${n}`));const values=data.pairs.filter(p=>p.pair===n);const p=values[0]||{};const inputs=['subject','teacher','room'].map((key,i)=>{const input=el('input');input.placeholder=['Предмет (пусто — нет пары)','Преподаватель','Кабинет'][i];input.value=p[key]||'';row.append(input);return input;});fields.push(inputs);form.append(row);}
 const save=el('button','btn btn--primary','Сохранить шаблон');save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await request(`/api/admin/template?${query()}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pairs:fields.map((f,i)=>({pair:i+1,subject:f[0].value,teacher:f[1].value,room:f[2].value}))})});toast('Шаблон сохранён на сервере','success');}catch(e){toast(e.message,'error');}finally{save.disabled=false;}};
 }catch(e){form.append(el('p','',e.message));}}
 group.onchange=day.onchange=week.onchange=load;await load();
 }catch(e){root.append(el('p','',e.message));}
}
