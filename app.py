import os
import time
import random
import requests
from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from cachetools import cached, TTLCache

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "google-clone-secret-2024")

# ─── User-Agent Pool ───────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
]

def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


# ─── DuckDuckGo HTML Search ────────────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_duckduckgo(query: str, page: int = 1):
    """Scrape DuckDuckGo HTML results (no API key needed)."""
    results = []
    start = time.time()

    # DuckDuckGo HTML (lite) endpoint
    url = "https://html.duckduckgo.com/html/"
    params = {"q": query}
    if page > 1:
        params["s"] = (page - 1) * 30      # DuckDuckGo uses 30 per page
        params["dc"] = (page - 1) * 30
        params["nextParams"] = ""
        params["v"] = "l"
        params["o"] = "json"
        params["api"] = "/d.js"

    try:
        resp = requests.post(
            url,
            data=params,
            headers=get_headers(),
            timeout=10
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Parse results
        for result in soup.select(".result__body"):
            title_el = result.select_one(".result__a")
            snippet_el = result.select_one(".result__snippet")
            url_el = result.select_one(".result__url")

            if not title_el:
                continue

            href = title_el.get("href", "")
            # DuckDuckGo wraps links — extract real URL
            real_url = _extract_ddg_url(href)

            results.append({
                "title": title_el.get_text(strip=True),
                "url": real_url or href,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                "date": "",
            })

    except requests.exceptions.RequestException as e:
        return None, str(e), 0

    elapsed = round(time.time() - start, 2)
    # DuckDuckGo doesn't expose total count; estimate
    estimated_total = max(len(results) * 10, 100) if results else 0
    return results, None, elapsed


def _extract_ddg_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect link."""
    if not href:
        return ""
    if href.startswith("http") and "duckduckgo" not in href:
        return href
    # Parse uddg param
    from urllib.parse import urlparse, parse_qs, unquote
    try:
        parsed = urlparse(href)
        params = parse_qs(parsed.query)
        if "uddg" in params:
            return unquote(params["uddg"][0])
        if parsed.path.startswith("//"):
            return "https:" + parsed.path
        if href.startswith("/"):
            return "https://duckduckgo.com" + href
    except Exception:
        pass
    return href


# ─── Bing Scrape (fallback) ────────────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_bing(query: str, page: int = 1):
    """Fallback: scrape Bing HTML results."""
    results = []
    start = time.time()
    first_result = (page - 1) * 10 + 1
    url = f"https://www.bing.com/search?q={requests.utils.quote(query)}&first={first_result}"

    try:
        resp = requests.get(url, headers=get_headers(), timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for li in soup.select("li.b_algo"):
            title_el = li.select_one("h2 a")
            snippet_el = li.select_one(".b_caption p") or li.select_one(".b_algoSlug")
            if not title_el:
                continue
            results.append({
                "title": title_el.get_text(strip=True),
                "url": title_el.get("href", ""),
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                "date": "",
            })
    except Exception as e:
        return None, str(e), 0

    elapsed = round(time.time() - start, 2)
    return results, None, elapsed


# ─── Routes ───────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/search")
def search():
    query = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))

    if not query:
        return jsonify({"error": "Please enter a search query", "results": [], "total": 0})

    results, error, elapsed = search_duckduckgo(query, page)

    # Fallback to Bing if DuckDuckGo fails or returns nothing
    if not results:
        results, error, elapsed = search_bing(query, page)

    if error and not results:
        return jsonify({"error": f"Search failed: {error}", "results": [], "total": 0})

    return jsonify({
        "results": results,
        "total": max(len(results) * 10, len(results)),
        "time": str(elapsed),
        "query": query,
        "page": page,
    })


@app.route("/suggest")
def suggest():
    """DuckDuckGo autocomplete suggestions."""
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"suggestions": []})

    try:
        resp = requests.get(
            "https://duckduckgo.com/ac/",
            params={"q": q, "type": "list"},
            headers=get_headers(),
            timeout=5
        )
        data = resp.json()
        # Response: ["query", [suggestions...]]
        if isinstance(data, list) and len(data) > 1:
            return jsonify({"suggestions": data[1][:8]})
    except Exception:
        pass

    return jsonify({"suggestions": []})


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    port = int(os.getenv("PORT", 5000))
    print(f"Google Clone running at http://localhost:{port}")
    app.run(debug=debug_mode, port=port, host="0.0.0.0")
