@echo off
chcp 65001 >nul
title Antigravity 中文汉化 - 还原官方英文
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

echo 正在关闭 Antigravity 并还原官方英文版，请稍候...
node localization_engine.js uninstall
if errorlevel 1 (
    echo.
    echo [失败] 还原未完成，请查看上方错误信息。
    pause
    exit /b 1
)

echo.
echo ============================================
echo  已还原官方英文版本。
echo ============================================
pause