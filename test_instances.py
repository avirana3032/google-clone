import requests
headers = {"User-Agent": "Mozilla/5.0"}
instances = [
    "https://vid.puffyan.us",
    "https://invidious.fdn.fr",  
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://invidious.privacyredirect.com",
    "https://yewtu.be",
    "https://inv.nadeko.net",
    "https://piped-api.kavin.rocks",
]
for inst in instances:
    try:
        if "piped" in inst:
            r = requests.get(f"{inst}/search", params={"q": "dog", "filter": "videos"}, headers=headers, timeout=6)
        else:
            r = requests.get(f"{inst}/api/v1/search", params={"q": "dog", "type": "video"}, headers=headers, timeout=6)
        if r.status_code == 200:
            vids = r.json()
            count = len(vids) if isinstance(vids, list) else len(vids.get("items", []))
            print(f"OK   {inst}: {count} videos, status={r.status_code}")
        else:
            print(f"FAIL {inst}: status={r.status_code}")
    except Exception as e:
        print(f"FAIL {inst}: {type(e).__name__}")
