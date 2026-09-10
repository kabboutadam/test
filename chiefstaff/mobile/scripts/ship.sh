#!/usr/bin/env bash
# One command to put the current app on TestFlight: take the repo's version of
# this folder, install, build in Expo's cloud, submit to Apple when done.
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "▸ syncing to origin/$BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH" >/dev/null
rm -rf ios android

echo "▸ installing"
npm install --no-audit --no-fund >/dev/null

echo "▸ checking native module versions against the Expo SDK"
node -e 'const b=require("./node_modules/expo/bundledNativeModules.json"),l=require("./package-lock.json").packages;let bad=0;for(const[n,r]of Object.entries(b)){const e=l["node_modules/"+n];if(!e)continue;const w=r.replace(/^[~^]/,""),h=e.version;if(!(r.startsWith("~")?h.split(".").slice(0,2).join(".")===w.split(".").slice(0,2).join("."):h.split(".")[0]===w.split(".")[0])){bad++;console.log("MISMATCH",n,h,"wants",r)}}process.exit(bad?1:0)'

echo "▸ building and submitting (10–20 minutes; safe to leave running)"
eas build --platform ios --profile testflight --auto-submit --non-interactive
echo
echo "Submitted. Apple emails when it's ready to test; then TestFlight → Update on the phone."
