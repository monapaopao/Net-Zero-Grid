/* Prefer complete paragraphs; paginate only when the fixed caption frame cannot fit. */
window.NZ_EXHIBITION_CAPTIONS=(()=>{
 const cache=new Map();
 function capacity(){const node=!document.getElementById('receptionBar')?.hidden?document.getElementById('receptionText'):document.getElementById('tourText');if(!node)return 130;const s=getComputedStyle(node),font=parseFloat(s.fontSize)||16;return Math.max(36,Math.floor(node.clientWidth/font)*(innerWidth>780?2:3));}
 function pages(text){const limit=capacity(),key=limit+'|'+text;if(cache.has(key))return cache.get(key);if(text.length<=limit)return [text];const sentences=text.match(/[^。！？；]+[。！？；]?/g)||[text],rows=[];let row='';for(const sentence of sentences){const chunks=sentence.length>limit?(sentence.match(/[^，]+，?/g)||[sentence]):[sentence];for(const chunk of chunks){if(row&&row.length+chunk.length>limit){rows.push(row);row='';}row+=chunk;}}if(row)rows.push(row);cache.set(key,rows);return rows;}
 function at(text,elapsed,duration){if(!text)return '';const rows=pages(text),total=rows.reduce((n,s)=>n+s.length,0);let until=0;for(const row of rows){until+=duration*row.length/total;if(elapsed<until)return row;}return rows.at(-1);}
 return {at,pages};
})();
