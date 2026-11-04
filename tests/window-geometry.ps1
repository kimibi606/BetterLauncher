param([Int64]$WindowHandle)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NativeWindowGeometry {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr edge, ref Rect bounds);
}
'@
$results = @()
foreach ($size in @(@(1280, 900), @(1600, 720), @(1184, 666), @(1920, 1080))) {
    foreach ($edge in 1..8) {
        $bounds = New-Object NativeWindowGeometry+Rect
        $bounds.Left = 200
        $bounds.Top = 100
        $bounds.Right = 200 + $size[0]
        $bounds.Bottom = 100 + $size[1]
        [void][NativeWindowGeometry]::SendMessage([IntPtr]$WindowHandle, 0x214, [IntPtr]$edge, [ref]$bounds)
        $results += @{ edge = $edge; width = $bounds.Right - $bounds.Left; height = $bounds.Bottom - $bounds.Top }
    }
}
ConvertTo-Json -InputObject $results -Compress
