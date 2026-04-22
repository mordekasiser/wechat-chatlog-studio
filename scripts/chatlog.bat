@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set "PROJECT_ROOT=%~dp0.."

if /I "%~1"=="ui" (
    shift
    python "%~dp0chatlog_visual.py" %*
    set EXIT_CODE=%ERRORLEVEL%
    echo.
    pause
    exit /b %EXIT_CODE%
)

if /I "%~1"=="cli" (
    shift
    python "%~dp0chatlog_tool.py" %*
    exit /b %ERRORLEVEL%
)

if "%~1"=="" (
    python "%~dp0chatlog_visual.py"
    set EXIT_CODE=%ERRORLEVEL%
    echo.
    pause
    exit /b %EXIT_CODE%
)

python "%~dp0chatlog_tool.py" %*
exit /b %ERRORLEVEL%
