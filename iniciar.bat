@echo off
title AulaSmart
cd /d "%~dp0"
where pnpm >nul 2>nul || (echo Falta pnpm & pause & exit /b 1)
if not exist node_modules\.pnpm (set CI=true& pnpm install)
start "" http://localhost:3002
pnpm dev
