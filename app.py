import os
import time
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from cachetools import cached, TTLCache
from xml.etree import ElementTree
import re

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "google-clone-secret-2024")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html",
}


# ─── TEXT SEARCH: Wikipedia + DDG Instant Answers ─────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_text(query: str, page: int = 1):
    start = time.time()
    results = []
    offset = (page - 1) * 20

    # 1) Wikipedia full-text search
    try:
        resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query", "list": "search", "srsearch": query,
                "format": "json", "srlimit": 20, "sroffset": offset,
                "srprop": "snippet|titlesnippet",
            },
            headers=HEADERS, timeout=6,
        )
        data = resp.json()
        for r in data.get("query", {}).get("search", []):
            snippet = re.sub(r"<.*?>", "", r.get("snippet", ""))
            results.append({
                "title": r["title"] + " - Wikipedia",
                "url": f"https://en.wikipedia.org/wiki/{r['title'].replace(' ', '_')}",
                "snippet": snippet,
                "date": "",
            })
    except Exception:
        pass

    # 2) DuckDuckGo Instant Answer API (related topics from many sources)
    if page == 1:
        try:
            resp = requests.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                headers=HEADERS, timeout=5,
            )
            data = resp.json()
            # Add abstract result if available
            if data.get("AbstractURL") and data.get("AbstractText"):
                results.insert(0, {
                    "title": data.get("Heading", query),
                    "url": data["AbstractURL"],
                    "snippet": data["AbstractText"][:300],
                    "date": "",
                })
            # Add related topics
            for topic in data.get("RelatedTopics", []):
                if isinstance(topic, dict) and topic.get("FirstURL"):
                    results.append({
                        "title": topic.get("Text", "")[:80],
                        "url": topic["FirstURL"],
                        "snippet": topic.get("Text", ""),
                        "date": "",
                    })
        except Exception:
            pass

    elapsed = round(time.time() - start, 2)
    if not results:
        return [], "No results found", elapsed
    return results, None, elapsed


# ─── IMAGE SEARCH: Wikimedia Commons ──────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_images(query: str):
    start = time.time()
    results = []
    try:
        resp = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query", "generator": "search",
                "gsrsearch": f"File: {query}", "gsrlimit": 30,
                "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
                "iiurlwidth": 400, "format": "json",
            },
            headers=HEADERS, timeout=8,
        )
        pages = resp.json().get("query", {}).get("pages", {})
        for pid, page in pages.items():
            info = page.get("imageinfo", [{}])[0]
            mime = info.get("mime", "")
            if not mime.startswith("image"):
                continue
            thumb = info.get("thumburl", info.get("url", ""))
            full = info.get("url", thumb)
            title = page.get("title", "").replace("File:", "").rsplit(".", 1)[0]
            results.append({
                "title": title,
                "url": info.get("descriptionurl", full),
                "image": full,
                "thumbnail": thumb,
                "source": "Wikimedia Commons",
            })
    except Exception:
        pass

    elapsed = round(time.time() - start, 2)
    if not results:
        return [], "No image results found", elapsed
    return results, None, elapsed


# ─── NEWS SEARCH: Google News RSS ─────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_news(query: str):
    start = time.time()
    results = []
    try:
        resp = requests.get(
            f"https://news.google.com/rss/search?q={requests.utils.quote(query)}&hl=en-US&gl=US&ceid=US:en",
            headers=HEADERS, timeout=6,
        )
        root = ElementTree.fromstring(resp.content)
        for item in root.findall(".//item")[:30]:
            title_el = item.find("title")
            link_el = item.find("link")
            pub_el = item.find("pubDate")
            source_el = item.find("source")
            desc_el = item.find("description")
            snippet = ""
            if desc_el is not None and desc_el.text:
                snippet = re.sub(r"<.*?>", "", desc_el.text)[:200]
            results.append({
                "title": title_el.text if title_el is not None else "",
                "url": link_el.text if link_el is not None else "",
                "snippet": snippet,
                "date": pub_el.text if pub_el is not None else "",
                "source": source_el.text if source_el is not None else "Google News",
            })
    except Exception:
        pass

    elapsed = round(time.time() - start, 2)
    if not results:
        return [], "No news results found", elapsed
    return results, None, elapsed


# ─── VIDEO SEARCH: Dailymotion API ────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_videos(query: str):
    start = time.time()
    results = []
    try:
        resp = requests.get(
            "https://api.dailymotion.com/videos",
            params={
                "search": query, "limit": 30, "sort": "relevance",
                "fields": "title,thumbnail_url,url,duration,created_time,owner.screenname",
            },
            headers=HEADERS, timeout=6,
        )
        data = resp.json()
        for v in data.get("list", []):
            dur = v.get("duration", 0)
            dur_str = f"{dur // 60}:{dur % 60:02d}" if dur else ""
            results.append({
                "title": v.get("title", ""),
                "url": v.get("url", ""),
                "description": "",
                "duration": dur_str,
                "published": "",
                "publisher": v.get("owner.screenname", "Dailymotion"),
                "thumbnail": v.get("thumbnail_url", ""),
            })
    except Exception:
        pass

    elapsed = round(time.time() - start, 2)
    if not results:
        return [], "No video results found", elapsed
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
    results, error, elapsed = search_text(query, page)
    if error and not results:
        return jsonify({"error": f"Search failed: {error}", "results": [], "total": 0})
    return jsonify({
        "results": results,
        "total": max(len(results) * 10, len(results)),
        "time": str(elapsed),
        "query": query,
        "page": page,
    })


@app.route("/search/images")
def images_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_images(query)
    return jsonify({"results": results, "time": str(elapsed)})


@app.route("/search/news")
def news_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_news(query)
    return jsonify({"results": results, "time": str(elapsed)})


@app.route("/search/videos")
def videos_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_videos(query)
    return jsonify({"results": results, "time": str(elapsed)})


@app.route("/suggest")
def suggest():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"suggestions": []})
    try:
        resp = requests.get(
            "https://suggestqueries.google.com/complete/search",
            params={"client": "firefox", "q": q},
            headers=HEADERS, timeout=3,
        )
        data = resp.json()
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
