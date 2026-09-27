@echo off
rem ==========================================================================
rem  COLETAR_BASES.bat - coleta e recorte de bases publicas para o SIG de Fundao
rem  Duplo clique. Acha o QGIS instalado e roda coletar_bases_fundao.py com o
rem  Python/GDAL dele. Nao precisa instalar nada alem do QGIS.
rem  Opcoes (pelo cmd): COLETAR_BASES.bat --itens 1,6   |   --listar   |   --refazer id
rem ==========================================================================
setlocal EnableExtensions EnableDelayedExpansion
title Coleta de bases publicas - SIG Fundao
cd /d "%~dp0"

set "SCRIPT=%~dp0coletar_bases_fundao.py"
if not exist "%SCRIPT%" (
    echo ERRO: coletar_bases_fundao.py nao esta na mesma pasta deste .bat.
    goto :fim_erro
)

set "PYQGIS="
set "O4WROOT="
set "PF64=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"

rem 1) QGIS do instalador: C:\Program Files\QGIS 3.xx (a versao mais nova vence)
for %%P in ("!PF64!" "!PF86!") do (
    for /f "delims=" %%D in ('dir /b /ad /o:n "%%~P\QGIS*" 2^>nul') do (
        if exist "%%~P\%%D\bin\o4w_env.bat" set "O4WROOT=%%~P\%%D"
        if exist "%%~P\%%D\bin\python-qgis-ltr.bat" set "PYQGIS=%%~P\%%D\bin\python-qgis-ltr.bat"
        if exist "%%~P\%%D\bin\python-qgis.bat" set "PYQGIS=%%~P\%%D\bin\python-qgis.bat"
    )
)

rem 2) OSGeo4W (instalador de rede)
if not defined PYQGIS (
    for %%R in ("C:\OSGeo4W" "C:\OSGeo4W64" "%LOCALAPPDATA%\Programs\OSGeo4W") do (
        if exist "%%~R\bin\o4w_env.bat" set "O4WROOT=%%~R"
        if exist "%%~R\bin\python-qgis-ltr.bat" set "PYQGIS=%%~R\bin\python-qgis-ltr.bat"
        if exist "%%~R\bin\python-qgis.bat" set "PYQGIS=%%~R\bin\python-qgis.bat"
    )
)

echo ============================================================================
echo  Coleta de bases publicas para o SIG de Fundao/ES
echo ============================================================================

if defined PYQGIS (
    echo Usando o Python do QGIS: !PYQGIS!
    echo.
    call "!PYQGIS!" "%SCRIPT%" %*
    set "CODIGO=!ERRORLEVEL!"
    goto :fim
)
if defined O4WROOT (
    echo Usando o ambiente do QGIS: !O4WROOT!
    echo.
    call "!O4WROOT!\bin\o4w_env.bat"
    python "%SCRIPT%" %*
    set "CODIGO=!ERRORLEVEL!"
    goto :fim
)

echo ERRO: nao encontrei o QGIS neste computador.
echo Procurei em "%ProgramFiles%\QGIS*", "Program Files (x86)\QGIS*" e C:\OSGeo4W.
echo Instale o QGIS (qgis.org) ou rode pelo "OSGeo4W Shell":
echo     python "%SCRIPT%"
goto :fim_erro

:fim
echo.
if "!CODIGO!"=="0" (
    echo Coleta concluida sem falhas.
) else (
    echo Coleta terminou com itens em FALHA. Veja _log_coleta.csv e rode de novo mais tarde:
    echo o que ja deu certo sera pulado.
)
echo.
pause
exit /b !CODIGO!

:fim_erro
echo.
pause
exit /b 1
