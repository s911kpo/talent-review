#!/usr/bin/env bash
# Netlify "ignore" check: decides whether a push rebuilds this site.
# Netlify's free plan has 300 credits a month and every production deploy costs 15; when credits run
# out, every site is paused. So pushes do NOT deploy unless the commit message asks for it:
#   [deploy prod]     rebuild the production site (DEPLOY_TARGET=production)
#   [deploy staging]  rebuild the test site
#   [deploy all]      both
# Exit 0 = skip this build (no deploy, no credits). Exit 1 = build.
msg="$(git log -1 --pretty=%B)"
target="${DEPLOY_TARGET:-staging}"
if [ "$target" = "production" ]; then tag="[deploy prod]"; else tag="[deploy staging]"; fi
case "$msg" in
  *"$tag"*|*"[deploy all]"*) echo "Deploy requested for $target."; exit 1 ;;
esac
echo "No $tag in the commit message: skipping the $target build to save Netlify credits."
exit 0
