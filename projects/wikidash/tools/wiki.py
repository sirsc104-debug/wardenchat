import json, time, gzip, hashlib, os, sys, urllib.request, urllib.parse
UA = "WikiRaceBuilder/1.0 (offline snapshot tool)"
API = "https://en.wikipedia.org/w/api.php"
def get(url, tries=6):
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Api-User-Agent": UA, "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return data
        except urllib.error.HTTPError as e:
            if e.code in (429, 503, 502, 504):
                wait = 5 * (i + 1)
                print(f"  {e.code}, waiting {wait}s", file=sys.stderr, flush=True)
                time.sleep(wait); continue
            raise
        except Exception as e:
            print(f"  err {e}, retry", file=sys.stderr, flush=True)
            time.sleep(3 * (i + 1))
    raise RuntimeError("gave up " + url)
def api(params):
    p = {"format": "json", "formatversion": "2", "maxlag": "5"}
    p.update(params)
    return json.loads(get(API + "?" + urllib.parse.urlencode(p)))
def fname(title):
    return hashlib.md5(title.encode()).hexdigest()
