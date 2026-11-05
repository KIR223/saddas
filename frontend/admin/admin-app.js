import { tryLogin, refreshSession, getCurrentUser, logout } from '../js/utils/auth.js';
import { initTheme, toggleTheme } from '../js/utils/theme.js';
import { request, fetchInfo, fetchGroups } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
import { renderUsers } from './users.js';
import { renderAudit } from './audit.js';
import { renderGroups } from './groups.js';
import { renderTemplate } from './template.js';
import { renderImport } from './import.js';
import { renderServerBells } from './bells-editor.js';
import { renderOverrides } from './overrides-editor.js';
import { renderCatalog } from './catalog-editor.js';
const titles={home:'Главная',groups:'Группы',schedule:'Шаблон недели',subs:'Замены',teachers:'Преподаватели',rooms:'Кабинеты',bells:'Звонки',data:'Импорт Excel',users:'Пользователи',audit:'Журнал сервера',more:'Ещё'};
const loginScreen=document.getElementById('login-screen'),app=document.getElementById('admin-app'),root=document.getElementById('adm-content'),error=document.getElementById('login-error');
function authUi(yes){loginScreen.hidden=yes;app.hidden=!yes;document.body.classList.toggle('adm-state-app',yes);document.body.classList.toggle('adm-state-login',!yes);}
async function home(){const [info,groups]=await Promise.all([fetchInfo(),fetchGroups()]);root.append(el('h2','','Общее расписание колледжа'));root.append(el('p','',`${groups.groups.length} групп · ${info.title||'Шаблон не загружен'}`));root.append(el('p','','Все изменения сохраняются на сервере и видны другим устройствам.'));navigation();}
function navigation(){for(const [key,title] of Object.entries(titles)){if(key==='more')continue;const b=el('button','btn btn--outline',title);b.onclick=()=>{location.hash=key;};root.append(b);}}
let generation=0;
async function render(){const user=getCurrentUser();if(!user){authUi(false);return;}if(user.role==='teacher'){location.replace('/teacher/');return;}authUi(true);const section=location.hash.slice(1)||'home';document.getElementById('adm-page-title').textContent=titles[section]||'Главная';document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('is-active',b.dataset.section===section));const ticket=++generation;clear(root);const slot=el('div');root.append(slot);
 try{switch(section){case 'users':await renderUsers(slot);break;case 'audit':await renderAudit(slot);break;case 'groups':await renderGroups(slot);break;case 'schedule':await renderTemplate(slot);break;case 'subs':await renderOverrides(slot);break;case 'teachers':await renderCatalog(slot,'teachers');break;case 'rooms':await renderCatalog(slot,'rooms');break;case 'bells':await renderServerBells(slot);break;case 'data':await renderImport(slot);break;case 'more':navigation();break;default:await home();}}catch(e){if(ticket===generation)slot.append(el('p','',e.message));}}
initTheme();document.getElementById('btn-theme')?.addEventListener('click',toggleTheme);
document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.section;});
document.querySelectorAll('[id^="btn-logout"]').forEach(b=>b.onclick=async()=>{await logout();authUi(false);clear(root);});
document.getElementById('login-form').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('login-submit');button.disabled=true;error.hidden=true;try{const out=await tryLogin(document.getElementById('login-user').value,document.getElementById('login-pass').value);document.getElementById('login-pass').value='';if(!out.ok)throw new Error(out.error);await render();}catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}};
window.addEventListener('hashchange',render);
await refreshSession();await render();
setInterval(async()=>{if(document.hidden)return;const u=await refreshSession();if(!u){authUi(false);clear(root);}},60000);
