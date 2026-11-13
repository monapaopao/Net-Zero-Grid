from faster_whisper import WhisperModel
from pathlib import Path
import json
r=Path('audio/完整导览/正式版')
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=6)
segments,info=model.transcribe(str(r/'校对用连续音频.wav'),language='zh',beam_size=5,initial_prompt='西比里，多园区，绿解化工，电解锌，氢氨合成蛋白，直流，V to G，DC DC，SMR。')
rows=[]
for s in segments:
 rows.append(dict(start=s.start,end=s.end,text=s.text));print(s.start,s.text,flush=True)
(r/'自动转写辅助校对.json').write_bytes(json.dumps(rows,ensure_ascii=False,indent=2).encode('utf-8'))
