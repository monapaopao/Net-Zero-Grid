from pathlib import Path
import json,subprocess
import imageio_ffmpeg
r=Path('audio/完整导览/正式版');m=json.loads((r/'manifest.json').read_text(encoding='utf-8'))
# Concatenate only spoken clips for independent recognition, retaining segment records.
raw=b'';off=0
for x in m['rows']:
 x['reviewStart']=off
 pcm=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(r/x['file']),'-f','s16le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
 raw+=pcm+b'\0'*16000;off=len(raw)/32000
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-f','s16le','-ar','16000','-ac','1','-i','pipe:0','-y',str(r/'校对用连续音频.wav')],input=raw,check=True)
(r/'recognition-input.json').write_bytes(json.dumps(m,ensure_ascii=False,indent=2).encode('utf-8'))
