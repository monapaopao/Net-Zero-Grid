import json,subprocess
from pathlib import Path
import imageio_ffmpeg
r=Path(__file__).resolve().parent
m=json.loads((r/'mix-timeline.json').read_text(encoding='utf-8'));pcm=bytearray(int(m['duration']*24000)*2)
for row in m['rows']:
 raw=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(r/row['file']),'-f','s16le','-ar','24000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
 start=round(row['start']*24000)*2;end=start+len(raw)
 assert end<=round(row['end']*24000)*2,(row['file'],end)
 pcm[start:end]=raw
out=r/'完整园区导览-云扬男声-完整试听.mp3'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-f','s16le','-ar','24000','-ac','1','-i','pipe:0','-b:a','128k','-y',str(out)],input=pcm,check=True)
print('Exported complete 364-second narration with timeline pauses:',out.name)
