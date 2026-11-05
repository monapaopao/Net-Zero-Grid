Add-Type -AssemblyName System.Drawing
$vp = Get-Content -Raw evidence/vehicle-native-preview.json | ConvertFrom-Json
$vbmp = [System.Drawing.Bitmap]::new(1440,990)
$vg = [System.Drawing.Graphics]::FromImage($vbmp)
$vg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$vg.Clear([System.Drawing.Color]::FromArgb(244,247,245))
$vfont=[System.Drawing.Font]::new('Arial',11)
for($vi=0;$vi -lt $vp.Count;$vi++){
 $vx=($vi%3)*480; $vy=[math]::Floor($vi/3)*330
 foreach($vf in $vp[$vi].faces){
  $vpoints=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($vx+$vf.p[0],$vy+$vf.p[1]),[System.Drawing.PointF]::new($vx+$vf.p[2],$vy+$vf.p[3]),[System.Drawing.PointF]::new($vx+$vf.p[4],$vy+$vf.p[5]))
  $vbrush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($vf.c[0],$vf.c[1],$vf.c[2]))
  $vg.FillPolygon($vbrush,$vpoints); $vbrush.Dispose()
 }
 $vg.DrawString($vp[$vi].id,$vfont,[System.Drawing.Brushes]::DarkSlateGray,($vx+12),($vy+308))
}
$vbmp.Save((Join-Path (Get-Location) 'evidence/vehicles-native-preview.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$vg.Dispose(); $vbmp.Dispose(); $vfont.Dispose()
