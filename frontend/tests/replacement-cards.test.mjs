import assert from 'node:assert/strict';
import { renderLessonCard, renderWeekLesson } from '../js/views/lesson.js';

class Node {
  constructor(){this.className='';this.children=[];this.textContent='';this.classList={
    add:name=>{this.className+=' '+name;},
    contains:name=>this.className.split(/\s+/).includes(name),
  };}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  setAttribute(){}
  addEventListener(){}
}
globalThis.document={createElement:()=>new Node()};
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
const lesson={pair:1,start:'09:15',end:'10:15',subject:'Физика',teacher:'Иванов И.И.',room:'307',type:'other',week:'green'};
for(const render of [renderLessonCard,renderWeekLesson]){
  // A general synchronization highlight must not use the replacement styling.
  const ordinary=render({...lesson,replaced:false},{isChanged:true});
  assert.equal(ordinary.classList.contains('is-changed'),false);
  assert.ok(!text(ordinary).includes('Замена'));
  const replaced=render({...lesson,replaced:true},{isChanged:false});
  assert.equal(replaced.classList.contains('is-changed'),true);
  assert.ok(text(replaced).includes('Замена'));
}
console.log('only actual replacements receive replacement styling: OK');
