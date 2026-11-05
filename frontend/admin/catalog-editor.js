import { request } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
export async function renderCatalog(root,kind) {
 clear(root);root.append(el('h2','',kind==='teachers'?'Преподаватели':'Кабинеты'));const report=el('p');root.append(report);
 const url='/api/admin/catalog/'+kind;
 try {
 const data=await request(url);const form=el('form','adm-card'),input=el('input'),add=el('button','btn btn--primary','Добавить');input.required=true;input.placeholder=kind==='teachers'?'Фамилия И.О.':'Кабинет';form.append(input,add);root.append(form);
 const mutate=async(path,method,name)=>{try{await request(path,{method,headers:{'Content-Type':'application/json'},...(name?{body:JSON.stringify({name})}:{})});await renderCatalog(root,kind);}catch(e){report.textContent=e.message;}};
 form.onsubmit=e=>{e.preventDefault();mutate(url,'POST',input.value);};
 for(const name of data[kind]){const row=el('div','adm-card');row.append(el('p','',name));const edit=el('button','btn','Переименовать'),del=el('button','btn','Удалить');edit.onclick=()=>{const next=prompt('Новое имя',name);if(next)mutate(url+'/'+encodeURIComponent(name),'PATCH',next);};del.onclick=()=>mutate(url+'/'+encodeURIComponent(name),'DELETE');row.append(edit,del);root.append(row);}
 }catch(e){report.textContent=e.message;}
}
