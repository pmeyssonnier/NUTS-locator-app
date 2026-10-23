@echo off
rem NUTS Locator - lanceur Windows : met a jour depuis GitHub (si git est installe), demarre le serveur local
rem et ouvre le navigateur sur l'adresse utilisee. Fermer la fenetre (ou Ctrl+C) arrete le serveur.
rem Usage : lancer-nuts.bat [branche]   (main par defaut)
setlocal
cd /d "%~dp0"
title NUTS Locator

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

set "BRANCH=%~1"
if "%BRANCH%"=="" set "BRANCH=main"

where git >nul 2>nul
if errorlevel 1 (
  echo Git est introuvable : pas de mise a jour, la version locale est utilisee.
) else (
  git fetch origin %BRANCH% && git checkout -q -B %BRANCH% FETCH_HEAD
  if errorlevel 1 (
    echo Mise a jour impossible ^(fichiers modifies localement ou pas de connexion^) : la version locale est utilisee.
  ) else (
    for /f "tokens=2 delims='" %%v in ('findstr /c:"VERSION=" src\version.js') do (
      echo Version : %%v
      goto :version_done
    )
  )
)
:version_done

node scripts\serve.mjs --open
if errorlevel 1 pause
endlocal
