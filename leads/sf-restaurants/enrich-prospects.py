#!/opt/homebrew/bin/python3
"""
Enrich prospect CSV with owner name + email.
Sources: website scraping + CA SOS business search + Google search.
Input:  Sales_associate_intern_SDR_prospects_SF_*.csv
Output: leads/sf-restaurants/prospects-enriched.csv
"""

import csv, json, re, time, urllib.parse, urllib.request, ssl, os, sys

try:
    from scrapling.fetchers import Fetcher
except ImportError:
    print("Run: pip3 install 'scrapling[all]' --break-system-packages")
    sys.exit(1)

INPUT_FILE  = '/Users/mantisclaw/.openclaw/media/inbound/Sales_associate_intern_SDR_prospects_SF_1840_10th_Ave_1---6b90c91e-cf67-4384-b2cc-6df73874015f.csv'
OUTPUT_FILE = '/Users/mantisclaw/.openclaw/workspace/leads/sf-restaurants/prospects-enriched.csv'
PROGRESS_FILE = '/Users/mantisclaw/.openclaw/workspace/leads/sf-restaurants/prospects-progress.json'

OUT_FIELDS = [
    'Company Name', 'owner_first_name', 'owner_last_name', 'owner_title',
    'email', 'Phone', 'Address', 'Website', 'Google Maps URL',
    'Rating', 'Reviews', 'is_chain', 'source', 'notes'
]

CHAINS = {
    'popeyes', 'little caesars', 'pollo campero', 'alamo drafthouse',
    'souvla', 'farmhouse kitchen', 'starbucks', 'subway', 'mcdonald',
    'chipotle', 'panda express', 'taco bell', 'burger king', 'kfc',
    'dunkin', 'in-n-out', 'chick-fil-a', 'domino', 'pizza hut',
    'ihop', 'denny', 'panera', 'five guys', 'shake shack',
    'sweetgreen', 'philz', 'blue bottle', 'dutch bros',
}

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"done": {}}

def save_progress(prog):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(prog, f, indent=2)

def is_chain(name):
    n = name.lower()
    return any(c in n for c in CHAINS)

def extract_emails(html, text=""):
    blocked = ['noreply','no-reply','sentry','wixpress','squarespace','example.com',
               'test@','@2x','.png','.jpg','.gif','cloudflare','schema.org','w3.org',
               'user@domain','email@email','placeholder','youremail']
    found = set()
    for src in [html, text]:
        for e in re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', src):
            found.add(e.lower())
        for e in re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', src):
            found.add(e.lower())
    clean = [e for e in found if not any(b in e for b in blocked) and '.' in e.split('@')[-1]]
    # Prefer personal/named emails
    preferred = [e for e in clean if any(k in e for k in ['owner','chef','hello','hi@','contact','booking'])]
    return preferred[0] if preferred else (clean[0] if clean else '')

SKIP_NAMES = {
    'the','our','this','your','their','its','new','san','great','best','first','second',
    'original','award','fresh','true','real','local','classic','authentic','open','family',
    'welcome','proud','born','also','now','us','here','all','just','only','many','get',
    'was','has','had','about','from','with','into','each','his','her','see','use','try',
    'for','and','but','not','are','been','have','that','they','were','what','when','who',
    'will','food','menu','chef','more','even','take','make','come','say','after','years',
    'since','over','two','three','currently','recently','previously','formerly','made',
    'known','located','serving','offering','featured','inspired','crafted','dedicated',
    'committed','passionate','excited','pleased','proud','will','also','then','there',
}

def extract_name(text):
    patterns = [
        (r'(?:owner|founder|proprietor|chef[- ]?owner)[:\s,]+([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)', "Owner"),
        (r'([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)[,\s]+(?:owner|founder|chef[- ]?owner|proprietor)', "Owner"),
        (r"(?:my name is|i'm|i am)\s+([A-Z][a-z]{2,})", "Owner"),
        (r'(?:opened|founded|started|created)\s+by\s+([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)', "Founder"),
        (r'(?:executive chef|chef[- ]owner|head chef)\s+([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)', "Chef/Owner"),
        (r'(?:chef)\s+([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)\s+(?:has|brings|opened|founded|is)', "Chef"),
        (r'([A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,})?)\s+(?:opened|founded|started)\s+(?:the |this |our )', "Owner"),
    ]
    for pattern, title in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            full = m.group(1).strip()
            parts = full.split()
            if not parts: continue
            first = parts[0].capitalize()
            last  = parts[1].capitalize() if len(parts) > 1 else ''
            if first.lower() in SKIP_NAMES or len(first) < 3: continue
            if not re.match(r'^[A-Z][a-z]{1,}$', first): continue
            return first, last, title
    return '', '', ''

# ── Website scraping ──────────────────────────────────────────────────────────

def scrape_website(url):
    if not url or url in ('undefined', 'null', ''):
        return '', '', '', ''
    if not url.startswith('http'):
        url = 'https://' + url

    # Strip tracking params from URLs
    url = url.split('?')[0].split('#')[0]

    fetcher = Fetcher()
    pages = [
        url,
        url.rstrip('/') + '/about',
        url.rstrip('/') + '/about-us',
        url.rstrip('/') + '/our-story',
        url.rstrip('/') + '/team',
        url.rstrip('/') + '/contact',
        url.rstrip('/') + '/contact-us',
    ]

    all_text, all_html = '', ''
    for page_url in pages[:4]:
        try:
            resp = fetcher.get(page_url, timeout=7)
            if resp:
                all_html += resp.html_content or ''
                all_text += resp.get_all_text() or ''
                first, last, title = extract_name(all_text)
                email = extract_emails(all_html, all_text)
                if first and email:
                    return first, last, title, email
        except Exception:
            pass
        time.sleep(0.4)

    first, last, title = extract_name(all_text)
    email = extract_emails(all_html, all_text)
    return first, last, title, email

# ── CA Secretary of State search ─────────────────────────────────────────────

def search_ca_sos(business_name):
    """
    Search CA SOS business registry for owner/agent info.
    Uses the public bizfile search API.
    Returns (owner_name, source_note) or ('', '').
    """
    fetcher = Fetcher()
    # CA SOS uses a search endpoint
    q = urllib.parse.quote(business_name)
    url = f"https://bizfileonline.sos.ca.gov/search/business?NAME={q}&NUMBER=&TYPE=ALL&STATUS=ACTIVE"
    try:
        resp = fetcher.get(url, timeout=10)
        if resp:
            text = resp.get_all_text() or ''
            html = resp.html_content or ''
            # Look for agent name patterns in the results
            # CA SOS shows "Agent: FirstName LastName" or similar
            for pattern in [
                r'Agent(?:\s+of\s+Service(?:\s+of\s+Process)?)?[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)',
                r'(?:Officer|Director|Manager)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)',
            ]:
                m = re.search(pattern, text, re.IGNORECASE)
                if m:
                    name = m.group(1).strip()
                    parts = name.split()
                    if len(parts) >= 2:
                        return parts[0], parts[1], 'CA SOS registry'
    except Exception:
        pass
    return '', '', ''

# ── Google enrichment ─────────────────────────────────────────────────────────

def google_search_owner(business_name, address=''):
    """Search Google for owner name."""
    fetcher = Fetcher()
    city = 'San Francisco'
    q = urllib.parse.quote(f'"{business_name}" owner {city} restaurant')
    url = f'https://www.google.com/search?q={q}&num=5'
    try:
        resp = fetcher.get(url, timeout=8)
        if resp:
            text = resp.get_all_text() or ''
            first, last, title = extract_name(text)
            if first:
                return first, last, title, 'Google search'
            # Also try "owned by" patterns
            for pat in [
                r'(?:owned|run|operated)\s+by\s+([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})',
                r'([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,}),?\s+(?:owner|founder)',
            ]:
                m = re.search(pat, text, re.IGNORECASE)
                if m:
                    f, l = m.group(1).capitalize(), m.group(2).capitalize()
                    if f.lower() not in SKIP_NAMES and len(f) >= 3:
                        return f, l, 'Owner', 'Google search'
    except Exception:
        pass
    return '', '', '', ''

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n🔍 SF Prospect Enricher")

    # Read input CSV
    with open(INPUT_FILE, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    print(f"   Input: {len(rows)} businesses\n")

    prog = load_progress()
    done = prog.get('done', {})

    results = []

    for i, row in enumerate(rows):
        name    = row.get('Company Name', '').strip()
        website = row.get('Website', '').strip()
        address = row.get('Address', '').strip()
        phone   = row.get('Phone', '').strip()

        # Already processed?
        if name in done:
            results.append(done[name])
            print(f"  [{i+1}] {name} — cached")
            continue

        print(f"  [{i+1}/{len(rows)}] {name}")

        lead = {
            'Company Name':      name,
            'owner_first_name':  '',
            'owner_last_name':   '',
            'owner_title':       '',
            'email':             '',
            'Phone':             phone,
            'Address':           address,
            'Website':           website if website not in ('undefined','null','') else '',
            'Google Maps URL':   row.get('Google Maps URL',''),
            'Rating':            row.get('Rating',''),
            'Reviews':           row.get('Reviews',''),
            'is_chain':          'yes' if is_chain(name) else 'no',
            'source':            '',
            'notes':             '',
        }

        if is_chain(name):
            print(f"       → chain/franchise, skipping owner search")
            lead['notes'] = 'Chain/franchise — individual owner not applicable'
            results.append(lead)
            done[name] = lead
            save_progress({'done': done})
            continue

        # Step 1: Scrape website
        if website and website not in ('undefined', 'null'):
            clean_url = website.split('?')[0]
            print(f"       → scraping {clean_url[:55]}")
            first, last, title, email = scrape_website(website)
            if first or email:
                lead.update({'owner_first_name': first, 'owner_last_name': last,
                             'owner_title': title, 'email': email, 'source': 'website'})
                print(f"       → found: {first} {last} | {email}")

        # Step 2: CA SOS search (if no name yet)
        if not lead['owner_first_name']:
            print(f"       → checking CA SOS registry...")
            first, last, src = search_ca_sos(name)
            if first:
                lead.update({'owner_first_name': first, 'owner_last_name': last,
                             'owner_title': 'Registered Agent', 'source': src})
                print(f"       → CA SOS: {first} {last}")
            time.sleep(1)

        # Step 3: Google search (if still no name)
        if not lead['owner_first_name']:
            print(f"       → Google search...")
            first, last, title, src = google_search_owner(name, address)
            if first:
                lead.update({'owner_first_name': first, 'owner_last_name': last,
                             'owner_title': title, 'source': src})
                print(f"       → Google: {first} {last}")
            time.sleep(1.5)

        results.append(lead)
        done[name] = lead
        save_progress({'done': done})
        time.sleep(1)

    # Write output
    print(f"\n💾 Writing {len(results)} rows to {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        writer.writeheader()
        writer.writerows(results)

    chains   = sum(1 for r in results if r['is_chain'] == 'yes')
    named    = sum(1 for r in results if r['owner_first_name'])
    emailed  = sum(1 for r in results if r['email'])

    print(f"\n✅ Done!")
    print(f"   Total:       {len(results)}")
    print(f"   Chains (skipped): {chains}")
    print(f"   With owner name:  {named}/{len(results)-chains} independent")
    print(f"   With email:       {emailed}/{len(results)-chains} independent")
    print(f"   Output: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
