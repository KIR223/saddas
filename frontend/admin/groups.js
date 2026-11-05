import { request } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
import { toast } from '../js/utils/toast.js';
export async function renderGroups(root) {
 clear(root);
 try {
 const out=await request('/api/admin/groups');
 const form=el('form','adm-card'),input=el('input');input.placeholder='Код группы, например ТМ-999';input.required=true;
 const add=el('button','btn btn--primary','Создать группу');form.append(input,add);root.append(form);
 form.onsubmit=async e=>{e.preventDefault();try{await request('/api/admin/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:input.value})});renderGroups(root);}catch(e){toast(e.message,'error');}};
 for(const g of out.groups){const row=el('div','adm-card');row.append(el('p','',`${g.code} · ${g.active?'активна':'архив'}`));const b=el('button','btn',g.active?'В архив':'Восстановить');b.onclick=async()=>{try{await request(`/api/admin/groups/${encodeURIComponent(g.code)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!g.active})});renderGroups(root);}catch(e){toast(e.message,'error');}};const del=el('button','btn','Удалить пустую');del.onclick=async()=>{try{await request(`/api/admin/groups/${encodeURIComponent(g.code)}`,{method:'DELETE'});renderGroups(root);}catch(e){toast(e.message,'error');}};row.append(b,del);root.append(row);}
 }catch(e){root.append(el('p','',e.message));}
}
