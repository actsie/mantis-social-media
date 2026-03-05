#!/opt/homebrew/bin/python3
"""
SF Restaurant Lead Scraper
Source: OpenStreetMap Overpass API (restaurant list) + website scraping (owner/email)
Output: leads/sf-restaurants/leads.csv

Fields: first_name, title, company, email, linkedin, website,
        business_address, google_review_link, yelp_link
"""

import csv
import json
import re
import time
import urllib.parse
import urllib.request
import ssl
import os
import sys

try:
    from scrapling.fetchers import Fetcher, DynamicFetcher
except ImportError:
    print("Run: pip3 install 'scrapling[all]' --break-system-packages")
    sys.exit(1)

OUTPUT_FILE   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.csv")
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "progress.json")

FIELDNAMES = [
    "first_name", "title", "company", "email",
    "linkedin", "website", "business_address",
    "google_review_link", "yelp_link", "phone", "notes"
]

# Skip chains + franchises — not independent owner targets
# These businesses don't control their own web presence (corporate/franchisor does)
CHAIN_BLACKLIST = {
    # Fast food chains
    'starbucks', 'mcdonald', "mcdonald's", 'subway', 'chipotle', 'panda express',
    'taco bell', 'burger king', 'wendy', 'domino', 'pizza hut', 'kfc',
    'dunkin', 'in-n-out', 'chick-fil-a', 'olive garden', 'applebee',
    'denny', 'ihop', 'five guys', 'panera', 'shake shack', 'sweetgreen',
    "jack in the box", 'carl jr', 'popeyes', 'sonic drive', 'whataburger',
    # Coffee chains
    'peet', "peet's", 'philz', 'blue bottle', 'dutch bros', 'coffee bean',
    # Pizza franchises
    'round table', 'little caesars',
    # Casual dining franchises
    'cheesecake factory', 'red lobster', 'outback', 'buffalo wild wings',
    'chilis', "chili's", 'hooters', 'cracker barrel', 'texas roadhouse',
    'mccormick', "mccormick's", 'mccormick & schmick',
    # Fast casual franchises
    'jersey mike', 'jimmy john', 'firehouse subs', 'potbelly',
    'wingstop', 'raising cane', 'zaxby',
    # Coffee/bakery chains
    'noah', "noah's bagels", 'einstein', 'cosi',
    # Grocery/retail food
    'whole foods', 'safeway', 'trader joe', 'target', 'costco',
    # Hotel restaurants (corporate)
    'marriott', 'hilton', 'hyatt', 'westin', 'sheraton', 'four seasons',
    'intercontinental', 'doubletree', 'courtyard',
}

# ── Progress ──────────────────────────────────────────────────────────────────

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"done_osm_ids": [], "leads": []}

def save_progress(prog):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(prog, f, indent=2)

# ── Utils ─────────────────────────────────────────────────────────────────────

def extract_emails_from_html(html_text):
    """Extract emails from both raw text and mailto: links."""
    emails = []
    # mailto: links (most reliable)
    mailto = re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html_text)
    emails.extend(mailto)
    # plain text pattern
    pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
    emails.extend(re.findall(pattern, html_text))
    # Dedupe + filter junk
    seen = set()
    clean = []
    blocked = ['noreply', 'no-reply', 'sentry', 'wixpress', 'squarespace',
               'example.com', 'test@', '@2x', '.png', '.jpg', '.gif',
               'cloudflare', 'schema.org', 'w3.org', 'openstreetmap',
               'user@domain', 'email@email', 'your@email', 'name@domain',
               'youremail', 'yourname', 'placeholder']
    for e in emails:
        e = e.lower().strip('.')
        if e not in seen and not any(b in e for b in blocked) and '.' in e.split('@')[-1]:
            seen.add(e)
            clean.append(e)
    return clean

def extract_owner_name(text):
    """Try to find owner/chef name from About/Contact page text."""
    patterns = [
        (r'(?:owner|founder|proprietor|chef[- ]?owner)[:\s,]+([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)', "Owner"),
        (r'([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)[,\s]+(?:owner|founder|chef[- ]?owner|proprietor)', "Owner"),
        (r"(?:my name is|i'm|i am)\s+([A-Z][a-z]+)", "Owner"),
        (r'(?:opened|founded|started|created)\s+by\s+([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)', "Founder"),
        (r'(?:executive chef|chef[- ]owner|head chef)\s+([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)', "Chef/Owner"),
        (r'(?:chef)\s+([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)\s+(?:has|brings|opened|founded|is)', "Chef"),
        (r'([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)\s+(?:has been|opened|founded|started)\s+(?:the restaurant|this restaurant|our restaurant)', "Owner"),
    ]
    skip_words = {
        'the', 'our', 'this', 'your', 'their', 'its', 'new', 'san', 'great',
        'best', 'first', 'second', 'original', 'award', 'fresh', 'true', 'real',
        'local', 'classic', 'authentic', 'open', 'family', 'welcome', 'proud',
        'born', 'also', 'now', 'us', 'here', 'all', 'just', 'only', 'many',
        'get', 'was', 'has', 'had', 'about', 'from', 'with', 'into', 'each',
        'his', 'her', 'its', 'see', 'use', 'try', 'for', 'and', 'but', 'not',
        'are', 'been', 'have', 'that', 'they', 'were', 'what', 'when', 'who',
        'will', 'food', 'menu', 'chef', 'more', 'even', 'take', 'make', 'come',
        'say', 'after', 'years', 'san', 'since', 'over', 'two', 'three',
        'currently', 'recently', 'previously', 'formerly', 'made', 'known',
        'located', 'serving', 'offering', 'featured', 'inspired', 'crafted',
        'dedicated', 'committed', 'passionate', 'excited', 'pleased', 'proud',
    }
    for pattern, title in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            full = m.group(1).strip()
            parts = full.split()
            if not parts:
                continue
            first = parts[0].capitalize()
            if first.lower() in skip_words or len(first) < 3:
                continue
            # Must look like a real name (starts with capital, no numbers)
            if not re.match(r'^[A-Z][a-z]{1,}$', first):
                continue
            return first, title
    return None, None

def google_maps_link(name, address):
    q = urllib.parse.quote(f"{name} {address}")
    return f"https://www.google.com/maps/search/?api=1&query={q}"

def yelp_search_link(name, address):
    city = "San Francisco, CA"
    q = urllib.parse.quote(name)
    loc = urllib.parse.quote(city)
    return f"https://www.yelp.com/search?find_desc={q}&find_loc={loc}"

def linkedin_google_search(first_name, company):
    if not first_name:
        return ""
    q = urllib.parse.quote(f'site:linkedin.com/in "{first_name}" "{company}" San Francisco restaurant')
    return f"https://www.google.com/search?q={q}"

def google_owner_search(company_name):
    """
    Search Google for '[company] owner San Francisco' and try to extract a name
    from the snippet text. Uses Fetcher with a Google search URL.
    Returns (first_name, title) or (None, None).
    """
    fetcher = Fetcher()
    q = urllib.parse.quote(f'"{company_name}" owner San Francisco restaurant')
    url = f"https://www.google.com/search?q={q}&num=5"
    try:
        resp = fetcher.get(url, timeout=8)
        if not resp:
            return None, None
        text = resp.get_all_text() or ""
        html = resp.html_content or ""
        # Look for owner name patterns in snippet text
        first, title = extract_owner_name(text)
        if first:
            return first, title
        # Also check for "owned by [Name]" or "[Name] owns" patterns in snippets
        for pattern in [
            rf'(?:owned|run|operated)\s+by\s+([A-Z][a-z]{{2,}}(?:\s[A-Z][a-z]{{2,}})?)',
            rf'([A-Z][a-z]{{2,}}(?:\s[A-Z][a-z]{{2,}})?),?\s+(?:owner|founder|proprietor)\s+of\s+{re.escape(company_name[:10])}',
        ]:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                name = m.group(1).strip().split()[0].capitalize()
                skip = {'the', 'this', 'that', 'new', 'san', 'our', 'his', 'her', 'its'}
                if name.lower() not in skip and len(name) >= 3:
                    return name, "Owner"
    except Exception:
        pass
    return None, None

# ── OpenStreetMap Overpass API ────────────────────────────────────────────────

def fetch_sf_restaurants(limit=200):
    """
    Pull restaurants from OpenStreetMap for San Francisco.
    Returns list of dicts with: name, address, website, phone, lat, lon, osm_id
    """
    # SF bounding box: south, west, north, east
    bbox = "37.7079,-122.5194,37.8325,-122.3573"

    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"]["name"]["website"]({bbox});
      way["amenity"="restaurant"]["name"]["website"]({bbox});
      node["amenity"="restaurant"]["name"]["contact:website"]({bbox});
      way["amenity"="restaurant"]["name"]["contact:website"]({bbox});
      node["amenity"="cafe"]["name"]["website"]({bbox});
      way["amenity"="cafe"]["name"]["website"]({bbox});
      node["amenity"="bar"]["name"]["website"]({bbox});
    );
    out center {limit};
    """

    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    data = urllib.parse.urlencode({"data": query}).encode()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    print(f"  Querying OpenStreetMap for SF restaurants...")
    result = None
    for endpoint in endpoints:
        try:
            req = urllib.request.Request(endpoint, data=data, headers={"User-Agent": "LeadScraper/1.0"})
            with urllib.request.urlopen(req, timeout=35, context=ctx) as resp:
                result = json.loads(resp.read())
            break
        except Exception as e:
            print(f"  ⚠️ {endpoint} failed: {e}, trying next...")

    if not result:
        print(f"  ❌ All Overpass endpoints failed")
        return []

    restaurants = []
    for el in result.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue

        # Build address
        addr_parts = []
        if tags.get("addr:housenumber") and tags.get("addr:street"):
            addr_parts.append(f"{tags['addr:housenumber']} {tags['addr:street']}")
        elif tags.get("addr:street"):
            addr_parts.append(tags["addr:street"])
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])
        elif "San Francisco" not in " ".join(addr_parts):
            addr_parts.append("San Francisco")
        if tags.get("addr:state"):
            addr_parts.append(tags["addr:state"])
        elif "CA" not in " ".join(addr_parts):
            addr_parts.append("CA")
        if tags.get("addr:postcode"):
            addr_parts.append(tags["addr:postcode"])

        address = ", ".join(addr_parts) if addr_parts else "San Francisco, CA"

        restaurants.append({
            "osm_id": str(el.get("id", "")),
            "name": name,
            "address": address,
            "website": tags.get("website", tags.get("contact:website", "")),
            "phone": tags.get("phone", tags.get("contact:phone", "")),
            "cuisine": tags.get("cuisine", ""),
        })

    print(f"  Found {len(restaurants)} restaurants in OpenStreetMap")
    return restaurants

# ── Website scraping ──────────────────────────────────────────────────────────

def scrape_website(url):
    """Scrape restaurant website for owner name, title, email."""
    result = {"first_name": None, "title": None, "email": None}
    if not url:
        return result

    # Normalize URL
    if not url.startswith("http"):
        url = "https://" + url

    fetcher = Fetcher()
    pages = [
        url,
        url.rstrip("/") + "/about",
        url.rstrip("/") + "/about-us",
        url.rstrip("/") + "/our-story",
        url.rstrip("/") + "/team",
        url.rstrip("/") + "/our-team",
        url.rstrip("/") + "/contact",
        url.rstrip("/") + "/contact-us",
    ]

    all_text = ""
    all_html = ""
    all_emails = []

    for page_url in pages[:5]:  # try up to 5 pages
        try:
            resp = fetcher.get(page_url, timeout=8)
            if resp:
                html  = resp.html_content or ""
                text  = resp.get_all_text() or ""
                all_text += " " + text
                all_html += " " + html
                all_emails.extend(extract_emails_from_html(html))
                all_emails.extend(extract_emails_from_html(text))
                # Stop early if we already have both name + email
                fname, _ = extract_owner_name(all_text)
                if fname and all_emails:
                    break
        except Exception:
            pass
        time.sleep(0.5)

    first_name, title = extract_owner_name(all_text)
    result["first_name"] = first_name
    result["title"] = title

    # Dedupe emails, prefer personal/contact ones over generic
    seen_e = set()
    deduped = []
    for e in all_emails:
        if e not in seen_e:
            seen_e.add(e)
            deduped.append(e)

    if deduped:
        preferred = [e for e in deduped if any(k in e for k in
                     ["owner", "chef", "hello", "hi@", "contact", "booking", "reserv"])]
        generic   = [e for e in deduped if e.startswith("info@") or e.startswith("hello@")]
        result["email"] = preferred[0] if preferred else (deduped[0] if deduped else "")

    return result

# ── Main ──────────────────────────────────────────────────────────────────────

def main(max_leads=200):
    print(f"\n🍽️  SF Restaurant Lead Scraper")
    print(f"   Target: {max_leads} leads\n")

    prog = load_progress()
    leads = prog.get("leads", [])
    done_ids = set(prog.get("done_osm_ids", []))

    # Step 1: Get restaurant list from OpenStreetMap
    print("📋 Step 1: Pulling SF restaurants from OpenStreetMap...")
    restaurants = fetch_sf_restaurants(limit=max_leads * 3)  # fetch extra since many lack websites

    if not restaurants:
        print("❌ No restaurants fetched. Check internet connection.")
        return

    # Filter out already processed
    to_process = [r for r in restaurants if r["osm_id"] not in done_ids]
    print(f"   {len(to_process)} new to process ({len(done_ids)} already done)\n")

    # Step 2: Enrich each restaurant
    print("🔍 Step 2: Enriching with website / owner data...")
    processed = 0

    for i, r in enumerate(to_process):
        if processed >= max_leads:
            break

        name    = r["name"]

        # Skip chains
        if any(chain in name.lower() for chain in CHAIN_BLACKLIST):
            print(f"  [{i+1}] Skipping chain: {name}")
            done_ids.add(r["osm_id"])
            prog["done_osm_ids"] = list(done_ids)
            save_progress(prog)
            continue
        address = r["address"]
        website = r["website"]
        phone   = r["phone"]

        print(f"  [{i+1}] {name}")
        if website:
            print(f"       → scraping {website[:60]}")

        # Scrape website
        site = scrape_website(website) if website else {}

        first_name = site.get("first_name") or ""
        title      = site.get("title") or ""
        email      = site.get("email") or ""

        # Google enrichment — try to find owner name if website didn't have it
        if not first_name and email:
            print(f"       → Google search for owner name...")
            first_name, title = google_owner_search(name)
            if first_name:
                print(f"       → Found via Google: {first_name} ({title})")
            time.sleep(1.5)  # be polite to Google

        lead = {
            "first_name":        first_name or "",
            "title":             title or "",
            "company":           name,
            "email":             email,
            "linkedin":          linkedin_google_search(first_name, name) if first_name else "",
            "website":           website,
            "business_address":  address,
            "google_review_link": google_maps_link(name, address),
            "yelp_link":         yelp_search_link(name, address),
            "phone":             phone,
            "notes":             r.get("cuisine", ""),
        }

        leads.append(lead)
        done_ids.add(r["osm_id"])
        prog["leads"] = leads
        prog["done_osm_ids"] = list(done_ids)
        save_progress(prog)

        processed += 1
        time.sleep(1)

    # Step 3: Write CSV
    print(f"\n💾 Step 3: Writing {len(leads)} leads to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(leads)

    with_email  = sum(1 for l in leads if l.get("email"))
    with_name   = sum(1 for l in leads if l.get("first_name"))
    with_website = sum(1 for l in leads if l.get("website"))

    print(f"\n✅ Done!")
    print(f"   Total leads:       {len(leads)}")
    print(f"   With website:      {with_website}/{len(leads)}")
    print(f"   With owner name:   {with_name}/{len(leads)}")
    print(f"   With email:        {with_email}/{len(leads)}")
    print(f"   Output: {OUTPUT_FILE}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scrape SF restaurant owner leads")
    parser.add_argument("--leads", type=int, default=50, help="Number of leads to collect")
    args = parser.parse_args()
    main(max_leads=args.leads)
