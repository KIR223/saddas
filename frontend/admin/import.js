import { request, uploadScheduleFile } from '../js/api/client.js';
import { el, clear } from '../js/utils/dom.js';
export async function renderImport(root) {
 clear(root);root.append(el('h2','','Импорт расписания на сервер'));
 try {
 const counts=await request('/api/admin/import-info');
 root.append(el('p','',`Замен: ${counts.overrides_total}. Сегодня и позже: ${counts.overrides_future}.`));
 const form=el('form','adm-card'),file=el('input');file.type='file';file.accept='.xlsx';file.required=true;
 const mode=el('select');for(const [v,t] of [['replace','Заменить весь шаблон'],['missing','Добавить только отсутствующие группы']]){const o=el('option','',t);o.value=v;mode.append(o);}
 const policy=el('select');policy.required=true;for(const [v,t] of [['','Что делать с существующими заменами?'],['keep',`Оставить все (${counts.overrides_total})`],['future',`Снять с сегодняшнего дня (${counts.overrides_future})`],['all',`Снять все (${counts.overrides_total})`]]){const o=el('option','',t);o.value=v;policy.append(o);}
 const submit=el('button','btn btn--primary','Импортировать'),report=el('div');form.append(file,mode,policy,submit);root.append(form,report);
 form.onsubmit=async e=>{e.preventDefault();if(!file.files[0]||!policy.value)return;submit.disabled=true;clear(report);report.append(el('p','','Импорт…'));try{const out=await uploadScheduleFile(file.files[0],undefined,{mode:mode.value,overrides_policy:policy.value});clear(report);report.append(el('p','',`Групп создано: ${out.diff.groups_created}. Пар записано: ${out.diff.lessons_created}, удалено: ${out.diff.lessons_removed}. Замен снято: ${out.diff.overrides_removed}, осталось: ${out.diff.overrides_remaining}.`));for(const warning of out.warnings)report.append(el('p','',warning));}catch(e){clear(report);report.append(el('p','',e.message));}finally{submit.disabled=false;}};
 }catch(e){root.append(el('p','',e.message));}
}
