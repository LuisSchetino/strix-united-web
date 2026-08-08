Option Explicit

Dim shell, folder, command
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd.exe /c cd /d """ & folder & """ && node tools\ea-local-bridge.mjs"
shell.Run command, 0, False
