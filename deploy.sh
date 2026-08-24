#!/usr/bin/env bash
# Ручной деплой TimurSounds на GitHub Pages.
# Публикует содержимое dist/ в ветку gh-pages.
#
# Использование:
#   1. bash deploy.sh
#   2. В репозитории: Settings → Pages → Source: Deploy from a branch → gh-pages / (root)
#
# Требуется git и доступ к remote origin.

set -e

echo "→ Собираю проект с относительными путями (--base=./)..."
npm run build -- --base=./

echo "→ Публикую dist/ в ветку gh-pages..."
npx --yes gh-pages -d dist -b gh-pages

echo ""
echo "Готово! Через 1–2 минуты сайт появится по адресу вида:"
echo "  https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПОЗИТОРИЯ/"
