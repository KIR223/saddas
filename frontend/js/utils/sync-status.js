let status={cached:false,lastAt:null,error:null};
export function syncStatus(){return {...status};}
export function setSyncStatus(patch){status={...status,...patch};globalThis.dispatchEvent?.(new CustomEvent('sync-status',{detail:syncStatus()}));}
export function mountSyncStatus(){
 const node=document.createElement('p');node.id='connection-status';node.className='now-widget__meta no-print';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
 document.getElementById('main')?.before(node);
 const render=()=>{
  const at=status.lastAt?new Date(status.lastAt).toLocaleString('ru-RU'):null;
  if(navigator.onLine===false||status.cached)node.textContent=`${navigator.onLine===false?'Офлайн':'Сеть недоступна — сохранённые данные'}${at?' · обновлено '+at:''}. Для ранее не открытых дат замены могут отсутствовать.`;
  else if(status.error)node.textContent=`Ошибка синхронизации: ${status.error}. ${at?'Сохранённые данные от '+at:'Снимка ещё нет — подключитесь к сети и выберите группу.'}`;
  else node.textContent=at?`Обновлено ${at}`:'Загрузка данных…';
 };
 window.addEventListener('api-cache',e=>setSyncStatus({cached:true,lastAt:status.lastAt||e.detail.at}));
 window.addEventListener('api-error',e=>setSyncStatus({error:e.detail.message}));
 window.addEventListener('api-success',e=>{if(!status.cached)setSyncStatus({lastAt:e.detail.at,error:null});});
 window.addEventListener('sync-status',render);
 window.addEventListener('offline',render);window.addEventListener('online',()=>{setSyncStatus({cached:false,error:'Нажмите обновить, чтобы получить актуальное расписание'});});
 render();return node;
}
