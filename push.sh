#!/bin/bash
git add .
git commit -m "update: $(date '+%d/%m/%Y %H:%M')"
git push origin main
