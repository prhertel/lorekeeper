"""Build a clean `site/` folder to upload to Netlify (or any static host).

Usage:  python publish.py

Copies only what the app needs (no .git, .claude, scripts or samples), then
drag the `site` folder onto https://app.netlify.com/drop, or onto your site's
Deploys page to publish an update.
"""
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "site")
INCLUDE = ["index.html", "css", "js", "assets"]

# Netlify headers: always revalidate code so updates show up on the next reload.
HEADERS = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer

/js/*
  Cache-Control: no-cache

/css/*
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache
"""


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for item in INCLUDE:
        src = os.path.join(ROOT, item)
        dst = os.path.join(OUT, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".*", "__pycache__"))
        else:
            shutil.copy2(src, dst)
    with open(os.path.join(OUT, "_headers"), "w", newline="\n") as f:
        f.write(HEADERS)
    files = sum(len(fs) for _, _, fs in os.walk(OUT))
    size = sum(os.path.getsize(os.path.join(d, x)) for d, _, fs in os.walk(OUT) for x in fs)
    print(f"Built {OUT}  ({files} files, {size / 1048576:.1f} MB)")
    print("Now drag the 'site' folder onto https://app.netlify.com/drop (first time)")
    print("or onto your site's Deploys page in Netlify (updates).")


if __name__ == "__main__":
    main()
