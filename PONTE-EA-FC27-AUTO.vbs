Option Explicit

Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd.exe /c cd /d ""C:\Users\ObeeN\Documents\STRIX UNITED FC27"" && node tools\ea-local-bridge.mjs", 0, False
