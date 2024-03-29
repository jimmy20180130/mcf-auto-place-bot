@echo off
cls
echo bot will restart when it crashes
title Jimmy Bot

:StartServer
echo (%time%) starting the bot
start /wait node %~dp0/mcf-auto-place-bot-main/start.js
echo (%time%) restarting the bot
goto StartServer
