@echo off
setlocal EnableExtensions EnableDelayedExpansion

set PYTHONUTF8=1
set PIP_DISABLE_PIP_VERSION_CHECK=1
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
set "VENV_DIR=%PROJECT_ROOT%\.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

cd /d "%PROJECT_ROOT%" || exit /b 1

if /I "%~1"=="install" (
    if /I "%~2"=="--dev" (
        call :ensure_environment --dev
    ) else (
        call :ensure_environment
    )
    set "EXIT_CODE=!ERRORLEVEL!"
    echo.
    if "!EXIT_CODE!"=="0" echo Environment is ready. Run scripts\chatlog.bat to start.
    pause
    exit /b !EXIT_CODE!
)

if /I "%~1"=="ui" (
    call :ensure_environment
    if errorlevel 1 (
        echo.
        pause
        exit /b 1
    )
    call :run_visual %*
    set "EXIT_CODE=!ERRORLEVEL!"
    echo.
    pause
    exit /b !EXIT_CODE!
)

if /I "%~1"=="cli" (
    call :ensure_environment
    if errorlevel 1 exit /b 1
    call :run_cli %*
    exit /b !ERRORLEVEL!
)

if "%~1"=="" (
    call :ensure_environment
    if errorlevel 1 (
        echo.
        pause
        exit /b 1
    )
    "%VENV_PYTHON%" "%SCRIPT_DIR%chatlog_visual.py"
    set "EXIT_CODE=!ERRORLEVEL!"
    echo.
    pause
    exit /b !EXIT_CODE!
)

"%VENV_PYTHON%" -c "import sys" >nul 2>nul
if errorlevel 1 (
    call :ensure_environment
    if errorlevel 1 exit /b 1
)
"%VENV_PYTHON%" "%SCRIPT_DIR%chatlog_tool.py" %*
exit /b %ERRORLEVEL%

:run_visual
shift /1
"%VENV_PYTHON%" "%SCRIPT_DIR%chatlog_visual.py" %*
exit /b %ERRORLEVEL%

:run_cli
shift /1
"%VENV_PYTHON%" "%SCRIPT_DIR%chatlog_tool.py" %*
exit /b %ERRORLEVEL%

:ensure_environment
set "NEEDS_INSTALL="
if /I "%~1"=="--dev" set "NEEDS_INSTALL=1"

if not exist "%VENV_PYTHON%" (
    echo [1/3] Checking Python 3.10 or newer...
    call :find_python
    if errorlevel 1 exit /b 1

    echo [2/3] Creating local virtual environment...
    "!PYTHON_EXE!" !PYTHON_ARGS! -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Failed to create .venv. Check your Python installation.
        exit /b 1
    )
    set "NEEDS_INSTALL=1"
) else (
    "%VENV_PYTHON%" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if errorlevel 1 (
        echo Existing .venv is not Python 3.10 or newer.
        echo Delete "%VENV_DIR%" and run this script again.
        exit /b 1
    )
)

"%VENV_PYTHON%" -c "import chatlog_studio, wdecipher, tqdm, loguru, Cryptodome" >nul 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"

if defined NEEDS_INSTALL (
    call :install_dependencies %*
    if errorlevel 1 exit /b 1
)

exit /b 0

:find_python
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_EXE=py"
        set "PYTHON_ARGS=-3"
        py -3 --version
        exit /b 0
    )
)

where python >nul 2>nul
if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_EXE=python"
        set "PYTHON_ARGS="
        python --version
        exit /b 0
    )
)

where python3 >nul 2>nul
if not errorlevel 1 (
    python3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_EXE=python3"
        set "PYTHON_ARGS="
        python3 --version
        exit /b 0
    )
)

echo Python 3.10 or newer was not found.
echo Install Python from https://www.python.org/downloads/windows/
echo During installation, enable "Add python.exe to PATH".
exit /b 1

:install_dependencies
set "INSTALL_TARGET=."
if /I "%~1"=="--dev" set "INSTALL_TARGET=.[dev]"

echo [3/3] Installing missing dependencies...
"%VENV_PYTHON%" -m pip install "setuptools>=77" wheel
if errorlevel 1 (
    echo Failed to update packaging tools. Check your network connection.
    exit /b 1
)

"%VENV_PYTHON%" -m pip install --no-build-isolation "%INSTALL_TARGET%"
if errorlevel 1 (
    echo Failed to install project dependencies. Check your network connection.
    exit /b 1
)

exit /b 0
