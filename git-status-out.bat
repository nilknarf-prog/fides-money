@echo off
cd /d "%~dp0"
git log --oneline -5 > git-result.txt 2>&1
git remote -v >> git-result.txt 2>&1
echo Done.
