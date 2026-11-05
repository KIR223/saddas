import { request, fetchTeachers } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
import { toast } from '../js/utils/toast.js';
const json = (method,body) => ({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export async function renderUsers(root) {
  clear(root); root.append(el('p','','Загрузка пользователей…'));
  try {
    const [out,catalog]=await Promise.all([request('/api/admin/users'),fetchTeachers()]);
    clear(root);
    const form=el('form','adm-card');
    const login=el('input');login.placeholder='Логин';login.required=true;login.autocomplete='off';
    const password=el('input');password.type='password';password.placeholder='Пароль (от 12 символов)';password.minLength=12;password.required=true;password.autocomplete='new-password';
    const role=el('select');for(const r of ['teacher','admin']) { const o=el('option','',r);o.value=r;role.append(o); }
    const teacher=el('select');const empty=el('option','','Выберите преподавателя');empty.value='';teacher.append(empty);
    for(const name of catalog.teachers) {const o=el('option','',name);o.value=name;teacher.append(o);}
    const add=el('button','btn btn--primary','Создать пользователя');add.type='submit';
    form.append(login,password,role,teacher,add);
    form.onsubmit=async e=>{e.preventDefault();add.disabled=true;try{await request('/api/admin/users',json('POST',{login:login.value,password:password.value,role:role.value,teacher_name:teacher.value||null}));password.value='';await renderUsers(root);}catch(err){toast(err.message,'error');}finally{add.disabled=false;}};
    root.append(form);
    for(const u of out.users) {
      const card=el('div','adm-card');card.append(el('p','',`${u.login} · ${u.role} · ${u.status} · ${u.teacher_name||''}`));
      const toggle=el('button','btn',u.status==='active'?'Отключить':'Включить');
      toggle.onclick=async()=>{try{await request(`/api/admin/users/${u.id}`,json('PATCH',{status:u.status==='active'?'disabled':'active'}));await renderUsers(root);}catch(e){toast(e.message,'error');}};
      const reset=el('button','btn','Задать новый пароль');reset.onclick=async()=>{const pw=prompt('Новый пароль (от 12 символов)');if(!pw)return;try{await request(`/api/admin/users/${u.id}`,json('PATCH',{password:pw}));toast('Пароль изменён, старые сессии закрыты','success');}catch(e){toast(e.message,'error');}};
      card.append(toggle,reset);root.append(card);
    }
  } catch(e) {clear(root);root.append(el('p','',e.message));}
}
