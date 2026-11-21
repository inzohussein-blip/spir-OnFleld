#!/usr/bin/env bash
# يجمع كل ملفات migrations بملف واحد (setup.sql) حتى تلصقه مرة وحدة بـ SQL Editor
set -euo pipefail
cd "$(dirname "$0")"
{
  echo "-- ملف الإعداد الكامل لقاعدة بيانات «احجزلي بالملعب» — مولّد تلقائياً من supabase/migrations"
  echo "-- لا تعدّله يدوياً: عدّل ملفات migrations وشغّل supabase/build-setup.sh"
  for f in migrations/*.sql; do
    echo
    echo "-- ================================================================"
    echo "-- $(basename "$f")"
    echo "-- ================================================================"
    cat "$f"
  done
} > setup.sql
echo "setup.sql: $(wc -c < setup.sql) bytes"
