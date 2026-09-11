#!/usr/bin/env bash
# Ручной деплой TimurSounds на GitHub Pages.
# Публикует содержимое dist/ в ветку gh-pages.
#
# Использование:
#   1. bash deploy.sh
#   2. В репозитории: Settings → Pages → Source: Deploy from a branch → gh-pages / (root)
#
# Требуется git и доступ к remote origin.
#
# Облачная синхронизация (необязательно): создайте файл .env.local рядом с
# package.json и пропишите в нём:
#   VITE_SUPABASE_URL=https://xxxx.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
# Vite подхватит их при сборке автоматически (см. supabase.sql).

set -e

echo "→ Собираю проект с относительными путями (--base=./)..."
npm run build -- --base=./

echo "→ Публикую dist/ в ветку gh-pages..."
npx --yes gh-pages -d dist -b gh-pages

echo ""
echo "Готово! Через 1–2 минуты сайт появится по адресу вида:"
echo "  https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПОЗИТОРИЯ/"
