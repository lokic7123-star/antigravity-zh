@echo off
chcp 65001 >nul
title Antigravity 中文汉化 - 安装
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

echo 正在关闭 Antigravity 并执行汉化，请稍候...
node localization_engine.js install
if errorlevel 1 (
    echo.
    echo [失败] 汉化未完成，请查看上方错误信息。
    pause
    exit /b 1
)

echo.
echo ============================================
echo  汉化完成！正在启动 Antigravity...
echo ============================================
start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
pause