@echo off
rem Antigravity zh launcher: ensure localization is injected (auto-reinstall
rem after app updates), then start the app.
cd /d "D:\opencode project1\antigravity-zh"
node localization_engine.js ensure
start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
