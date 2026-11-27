#!/usr/bin/env bash
# Privacy test for supabase/schema.sql. Needs a Postgres server; set PGHOST/PGPORT/PGUSER (default: local socket).
# Run: npm run test:db
set -e
cd "$(dirname "$0")/.."
psql -q -c "drop database if exists qk_rls" -c "create database qk_rls" >/dev/null
out=$(psql -q -t -d qk_rls -f tests/rls.sql 2>&1 | sed '/^\s*$/d')
echo "$out"
psql -q -c "drop database qk_rls" >/dev/null
echo "$out" | grep -q "rls: all pass"
