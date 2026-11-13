import asyncio,json,subprocess,hashlib
from pathlib import Path
import edge_tts,imageio_ffmpeg
ROOT=Path(__file__).resolve().parent
async def main():
 d=json.loads((ROOT/'script.json').read_text(encoding='utf-8'));results=[]
 for i,row in enumerate(d['rows']):
  p=ROOT/row['file'];digest=hashlib.sha256((d['voice']+d['rate']+row['spoken']).encode()).hexdigest();stamp=p.with_suffix('.sha256')
  if not(p.exists() and stamp.exists() and stamp.read_text()==digest):
   for attempt in range(3):
    try:
     await edge_tts.Communicate(row['spoken'],d['voice'],rate=d['rate']).save(str(p));stamp.write_text(digest);break
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(2)
  raw=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(p),'-f','s16le','-ar','24000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
  seconds=len(raw)/48000
  if not raw:raise ValueError('empty audio '+str(p))
  results.append(dict(**row,audioDuration=round(seconds,3),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
  print(f'{i+1}/{len(d["rows"])} {row["id"]}: {seconds:.2f}s / {row["end"]-row["start"]}s',flush=True)
 (ROOT/'manifest.json').write_bytes(json.dumps(dict(voice=d['voice'],rate=d['rate'],rows=results),ensure_ascii=False,indent=2).encode('utf-8'))
asyncio.run(main())
