#!/usr/bin/env python3
"""
check-verify-jwt-drift.py — assert supabase/config.toml's verify_jwt declarations
match the LIVE Supabase gateway state for every deployed edge function.

WHY: `supabase functions deploy` (no name) applies the CLI default verify_jwt=true
to any function NOT declared in config.toml. If config drifts from live, a bulk
deploy silently flips functions to require a JWT and breaks every cron / DB-webhook
/ service-key caller (non-JWT sb_secret_* key). This gate freezes that perimeter.

USAGE:
  1. Refresh the live snapshot (MCP list_edge_functions or supabase CLI) into
     scripts/live-edge-functions.json  as  {"functions":[{"slug":...,"verify_jwt":bool},...]}
  2. python3 scripts/check-verify-jwt-drift.py
Exit 0 = 0 mismatches. Exit 1 = drift (printed per-function).

A function declared in config but NOT live, or live but NOT declared, is reported.
The CLI default for an UNDECLARED function is verify_jwt=true, so any live-false
function MUST be declared false in config — that case is flagged as a mismatch.
"""
import json, re, sys, os

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG=os.path.join(ROOT,'supabase','config.toml')
SNAP=os.path.join(ROOT,'scripts','live-edge-functions.json')

def parse_config(path):
    decl={}
    cur=None
    for line in open(path):
        m=re.match(r'\s*\[functions\.([A-Za-z0-9_-]+)\]',line)
        if m: cur=m.group(1); continue
        m=re.match(r'\s*verify_jwt\s*=\s*(true|false)',line)
        if m and cur is not None:
            decl[cur]=(m.group(1)=='true'); cur=None
    return decl

def main():
    if not os.path.exists(SNAP):
        print('ERROR: %s missing. Refresh from MCP list_edge_functions / supabase CLI.'%SNAP); return 2
    live={x['slug']:bool(x['verify_jwt']) for x in json.load(open(SNAP))['functions']}
    decl=parse_config(CONFIG)
    CLI_DEFAULT=True  # supabase deploy default for undeclared functions
    mism=[]
    for slug,lv in sorted(live.items()):
        effective=decl.get(slug, CLI_DEFAULT)  # what a deploy would set
        if effective!=lv:
            how='undeclared->CLI default true' if slug not in decl else ('declared %s'%decl[slug])
            mism.append('  MISMATCH %-45s live=%-5s config-effective=%-5s (%s)'%(slug,lv,effective,how))
    # config declares something not live (stale/renamed) — warn, not fatal
    stale=[s for s in decl if s not in live]
    print('Live functions: %d   Declared in config: %d'%(len(live),len(decl)))
    if stale:
        print('NOTE (non-fatal) config declares %d not-live slug(s): %s'%(len(stale),', '.join(sorted(stale))))
    if mism:
        print('\n%d verify_jwt MISMATCH(es) — a bulk deploy would change gateway state:'%len(mism))
        print('\n'.join(mism)); return 1
    print('\nOK: 0 mismatches. config.toml verify_jwt == live for all %d functions. Bulk deploy is idempotent.'%len(live))
    return 0

sys.exit(main())
