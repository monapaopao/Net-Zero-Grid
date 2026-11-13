/* Time-based subtitle pages, shared by both exhibition routes. No audio is implied. */
window.NZ_EXHIBITION_CAPTIONS=(()=>{
 const cache=new Map();
 function pages(text){if(cache.has(text))return cache.get(text);const clauses=text.match(/[^，。！？；]+[，。！？；]?/g)||[text],rows=[];let row='';for(const clause of clauses){if(row&&row.length+clause.length>58){rows.push(row);row='';}row+=clause;}if(row)rows.push(row);cache.set(text,rows);return rows;}
 function at(text,elapsed,duration){if(!text)return '';const rows=pages(text),total=rows.reduce((n,s)=>n+s.length,0);let until=0;for(const row of rows){until+=duration*row.length/total;if(elapsed<until)return row;}return rows.at(-1);}
 return {at,pages};
})();
