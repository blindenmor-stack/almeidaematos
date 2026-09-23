#!/usr/bin/env python3
"""QA visual: screenshots full-page em 390 / 768 / 1280 px.

Uso:
  python3 scripts/qa-screenshots.py <url> [<url> ...] [--out docs/qa] [--widths 390,768,1280] [--tag nome]

Exemplos:
  python3 scripts/qa-screenshots.py http://localhost:4173/advocacia-sao-paulo/ --tag escritorio
  python3 scripts/qa-screenshots.py https://almeidaematos.com.br/beneficios/auxilio-acidente/ --tag ref

Também lista erros de console, requests 4xx/5xx e imagens sem width/height.
"""
import argparse, os, re, sys, json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('urls', nargs='+')
ap.add_argument('--out', default='docs/qa')
ap.add_argument('--widths', default='390,768,1280')
ap.add_argument('--tag', default='')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
widths = [int(w) for w in a.widths.split(',')]

def slug(u):
    p = urlparse(u).path.strip('/').replace('/', '_') or 'home'
    return (a.tag + '_' if a.tag else '') + p

report = {}
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for url in a.urls:
        errors, bad = [], []
        for w in widths:
            ctx = browser.new_context(viewport={'width': w, 'height': 900}, device_scale_factor=1,
                                      is_mobile=w < 500, has_touch=w < 500)
            page = ctx.new_page()
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
            page.goto(url, wait_until='networkidle', timeout=60000)
            # forçar reveal de animações pra print ver tudo
            page.evaluate("""() => { document.querySelectorAll('[data-reveal],[data-reveal-title]').forEach(e=>{e.style.opacity=1;e.style.transform='none';e.classList.add('is-visible','revealed')}); window.scrollTo(0, document.body.scrollHeight); }""")
            page.wait_for_timeout(800)
            page.evaluate("window.scrollTo(0,0)")
            page.wait_for_timeout(300)
            path = os.path.join(a.out, f'{slug(url)}_{w}.png')
            page.screenshot(path=path, full_page=True)
            print('ok', path)
            if w == widths[-1]:
                info = page.evaluate("""() => ({
                    title: document.title,
                    desc: document.querySelector('meta[name=description]')?.content,
                    canonical: document.querySelector('link[rel=canonical]')?.href,
                    h1: [...document.querySelectorAll('h1')].map(h=>h.textContent.trim()),
                    imgsSemDim: [...document.images].filter(i=>!i.getAttribute('width')||!i.getAttribute('height')).map(i=>i.getAttribute('src')),
                    imgsQuebradas: [...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src')),
                    ldjson: [...document.querySelectorAll('script[type="application/ld+json"]')].length,
                    waLinks: [...document.querySelectorAll('a[href*="wa.me"]')].length,
                    docHeight: document.body.scrollHeight,
                    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                })""")
                report[url] = {**info, 'consoleErrors': errors[:10], 'badRequests': sorted(set(bad))[:20]}
            ctx.close()
    browser.close()
print(json.dumps(report, ensure_ascii=False, indent=1))
