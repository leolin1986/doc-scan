@echo off
chcp 65001 >nul
echo ================================
echo  DocScan - 在线文档扫描工具
echo ================================
echo.

:: 进入项目目录
cd /d "%~dp0"

:: 检查依赖是否已安装
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    echo.
)

:: 清理上次编译缓存，避免缓存损坏导致启动失败
echo 清理编译缓存...
if exist ".next" rmdir /s /q ".next"

:: 启动开发服务器
echo 启动开发服务器...
echo.
call npm run dev
