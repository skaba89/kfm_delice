#!/bin/bash
cd /home/z/my-project
NODE_OPTIONS="--max-old-space-size=512" exec npx next dev -p 3000 2>&1 | tee -a dev.log
