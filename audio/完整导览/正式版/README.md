# 完整园区导览配音

v21.5.0 使用已确认的云扬男声，普通话与英文由同一音色整句合成，语速 -8%。快速预览没有配音。

- manifest.json：28段显示原文、朗读文本、MP3时长和SHA-256。
- 朗读对照与校对记录.md：实际网页窗口与校对范围。
- mix-timeline.json：当前364秒音频拼接时间表。
- 完整园区导览-云扬男声-完整试听.mp3：按网页时间轴导出的连续试听，含停顿。
- 自动转写辅助校对.json：Whisper small独立识别结果，含同音字和专业缩写误识，不是人工听校结论。

MP3为24kHz单声道；网页以Web Audio解码播放，所有分段已内嵌主HTML，无在线语音请求。生成使用微软Edge神经语音；原始输入保存在script.json，哈希缓存防止重复请求。

重新生成音频（开发时需联网）：

```powershell
uv run --with edge-tts==7.3.1 --with imageio-ffmpeg==0.8.1 python audio/完整导览/正式版/generate.py
node visual-upgrade/webgpu/build.cjs
node visual-upgrade/tours/export.cjs
```

变更文案前应同步script.json，并重新生成manifest.json；构建会核对显示原文和音频时长，不容许旧音频静默匹配新字幕。
