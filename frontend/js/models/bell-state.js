// In-memory mirror of the server response; persistence belongs to the offline snapshot.
let config = {regular:[],monThu:[],thursday:[],shortDay:[],curator:{enabled:false,days:[],byDay:{}},exceptions:{}};
export const bellState = () => config;
export function installBellState(value) {
 if(!value)return config;
 const byDay={};for(const s of value.curators||[])if(s.enabled)byDay[s.day]={start:s.start,end:s.end,title:s.title};
 config={...value,curator:{enabled:Object.keys(byDay).length>0,days:Object.keys(byDay).map(Number),byDay}};
 return config;
}
