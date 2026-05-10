#!/usr/bin/env python3
import pathlib, sys

p = pathlib.Path("app/settings/page.tsx")
if not p.exists():
    sys.exit("Run from Musicanaz root")

src = p.read_text()
dup = 'import { YTCookiesPanel } from "@/components/yt-cookies-panel"\nimport { YTCookiesPanel } from "@/components/yt-cookies-panel"'
fix = 'import { YTCookiesPanel } from "@/components/yt-cookies-panel"'

if dup in src:
    p.write_text(src.replace(dup, fix, 1))
    print("✓ Fixed duplicate import")
else:
    print("- No duplicate found, checking manually...")
    lines = src.splitlines()
    seen = False
    out = []
    for line in lines:
        if 'import { YTCookiesPanel }' in line:
            if seen:
                print(f"  removed duplicate: {line}")
                continue
            seen = True
        out.append(line)
    p.write_text("\n".join(out))
    print("✓ Done")
