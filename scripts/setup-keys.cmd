@echo off
rem Double-click to fill .env.local from a Supabase access token.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-keys.ps1"
