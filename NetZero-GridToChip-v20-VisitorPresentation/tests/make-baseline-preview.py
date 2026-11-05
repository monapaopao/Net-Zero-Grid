from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root.parent/'GobiLight-NetZero-v1.3.5'/'GobiLight-NetZero-v1.3.5'/'dist'/'Net-Zero-grid-premium.html'
out=root/'screenshots';out.mkdir(exist_ok=True)
html=source.read_text(encoding='utf-8')
# An independent screenshot fixture; never write to the original release.
fixture='''<script>
const baseline=window.__NZ_TEST;
baseline.S.running=false;
baseline.stepSeconds(3600);
baseline.camera.fov=34;
baseline.camera.position.set(310,260,350);
baseline.controls.target.set(40,0,42);
baseline.camera.updateProjectionMatrix();
baseline.controls.update();
</script>'''
(out/'baseline-preview.html').write_text(html.replace('</body>',fixture+'</body>'),encoding='utf-8')
