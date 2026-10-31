' Double-click to launch TV Center (no console window).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
desktopDir = root & "\desktop"
exe = desktopDir & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "TV Center isn't set up yet." & vbCrLf & "Run 'npm install' inside the desktop folder once.", 48, "TV Center"
  WScript.Quit
End If
sh.CurrentDirectory = desktopDir
sh.Run """" & exe & """ .", 1, False
