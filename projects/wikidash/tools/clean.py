"""Turn Parsoid render HTML into compact game HTML.

clean(html, resolve) -> dict(desc, extract, html, nav, body_ids, nav_ids)
  resolve(title, is_redirect) -> article id (int) or None
Links to articles in the set become <a i="ID">, in-page anchors <a f="frag">,
everything else is unwrapped to text.
"""
import re
import urllib.parse
import lxml.html
from lxml import etree

DROP_SECTIONS = {
    "references", "notes", "footnotes", "citations", "sources", "bibliography", "further reading",
    "external links", "notes and references", "works cited", "explanatory notes", "general and cited sources",
    "general bibliography", "cited sources", "primary sources", "secondary sources", "literature",
    "references and notes", "notes and citations", "reference notes", "general sources", "cited works",
    "sources and further reading", "external sources", "online sources", "general references",
    "specific references", "inline citations", "informational notes", "endnotes", "citations and notes",
    "works consulted", "selected bibliography", "further reading and external links", "references cited",
    "bibliography and further reading", "external link", "reference", "note",
}

DROP_SEL = [
    "style", "link", "meta", "script", "noscript", "sup.reference", "sup.noprint", ".mw-editsection",
    ".mw-empty-elt", ".ambox", ".ombox", ".tmbox", ".cmbox", ".fmbox", ".imbox", ".mbox-small", ".metadata",
    ".mw-references-wrap", ".reflist", ".refbegin", ".authority-control", ".portalbox", ".portal",
    ".sistersitebox", ".side-box", "#coordinates", ".geo-inline-hidden", ".mw-kartographer-maplink",
    ".mw-kartographer-map", ".navbar", ".noprint.portal", "img", "audio", "video", ".mwe-math-fallback-image-inline",
    ".mwe-math-fallback-image-display", ".infobox-image", ".shortdescription", ".mw-file-description",
    ".timeline-wrapper", ".mw-graph", ".chart", ".plainlist.noprint", ".spoken-wikipedia", ".listen",
    ".haudio", ".wikitable.mw-collapsible.mw-collapsed", ".box-Multiple_issues", ".stub", ".asbox",
    ".mw-cite-backlink", ".citation-needed-content", ".Inline-Template", ".mw-ext-score", ".gallerytext",
    "gallery", "ul.gallery", ".gallery", ".thumbimage", ".mw-halign-center.mw-default-size img",
]
NAV_SEL = [".navbox", ".vertical-navbox", "table.sidebar", ".navbox-styles"]

KEEP_TAGS = {
    "p", "a", "b", "i", "em", "strong", "ul", "ol", "li", "dl", "dt", "dd", "h2", "h3", "h4", "h5", "table",
    "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "blockquote", "sub", "sup", "br", "small", "abbr",
    "cite", "q", "code", "pre", "s", "u", "figure", "figcaption", "math", "semantics", "mrow", "mi", "mo", "mn",
    "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mtext", "mspace", "mstyle", "mtable", "mtr", "mtd",
    "munder", "mover", "munderover", "mpadded", "mphantom", "menclose", "annotation", "mfenced", "ms", "div",
    "hr", "bdi", "var", "time", "ruby", "rt", "rp", "wbr", "mark", "kbd", "samp", "del", "ins", "big",
}
KEEP_CLASS = {
    "infobox", "wikitable", "hatnote", "quotebox", "infobox-above", "infobox-header", "infobox-label",
    "infobox-data", "infobox-caption", "infobox-subheader", "infobox-below", "infobox-full-data", "sortable",
    "plainlist", "hlist", "toccolours", "mwe-math-element", "texhtml", "nowrap", "reflist", "div-col",
    "infobox-title", "multicol", "cquote", "blockquote", "rquote", "pullquote", "mw-heading", "wikitable-tight",
}
MATH = {"math", "semantics", "mrow", "mi", "mo", "mn", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot",
        "mtext", "mspace", "mstyle", "mtable", "mtr", "mtd", "munder", "mover", "munderover", "mpadded",
        "mphantom", "menclose", "annotation", "mfenced", "ms"}
KEEP_ATTR = {"colspan", "rowspan", "scope", "display", "mathvariant", "stretchy", "fence", "separator",
             "accent", "accentunder", "displaystyle", "scriptlevel", "columnalign", "rowspacing",
             "columnspacing", "lspace", "rspace", "width", "depth", "height", "linethickness", "encoding"}

WIKI = "https://en.wikipedia.org/wiki/"


def norm_title(raw):
    t = urllib.parse.unquote(raw).split("#")[0].replace("_", " ")
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        return ""
    return t[0].upper() + t[1:]


def css(root, sel):
    try:
        return root.cssselect(sel)
    except Exception:
        return []


def unwrap(el):
    parent = el.getparent()
    if parent is None:
        return
    idx = parent.index(el)
    # move text
    prev = el.getprevious()
    if el.text:
        if prev is not None:
            prev.tail = (prev.tail or "") + el.text
        else:
            parent.text = (parent.text or "") + el.text
    kids = list(el)
    for k in kids:
        parent.insert(idx, k)
        idx += 1
    last = kids[-1] if kids else el.getprevious()
    if el.tail:
        if kids:
            kids[-1].tail = (kids[-1].tail or "") + el.tail
        elif last is not None and last is not el:
            last.tail = (last.tail or "") + el.tail
        else:
            parent.text = (parent.text or "") + el.tail
    parent.remove(el)


def remove(el):
    parent = el.getparent()
    if parent is None:
        return
    if el.tail:
        prev = el.getprevious()
        if prev is not None:
            prev.tail = (prev.tail or "") + el.tail
        else:
            parent.text = (parent.text or "") + el.tail
    parent.remove(el)


def link_title(a):
    href = a.get("href") or ""
    if href.startswith("/wiki/"):
        path = href[len("/wiki/"):]
    elif href.startswith(WIKI):
        path = href[len(WIKI):]
    else:
        return None
    if "?" in path:
        return None
    t = norm_title(path)
    if not t:
        return None
    if ":" in t:
        ns = t.split(":", 1)[0].lower()
        if ns in {"file", "image", "media", "category", "help", "special", "wikipedia", "wp", "project",
                  "template", "portal", "talk", "user", "draft", "mediawiki", "module", "timedtext", "book",
                  "wikt", "wiktionary", "s", "commons", "q", "n", "b", "v", "voy", "species", "d", "mw",
                  "meta", "c", "w", "wikisource", "wikiquote", "wikibooks", "wikinews", "wikivoyage", "doi",
                  "iso 639-3", "event", "gadget", "topic"} or ns.endswith(" talk") or len(ns) <= 3:
            return None
    return t


def text_of(el):
    return re.sub(r"\s+", " ", el.text_content() or "").strip()


def clean(html, resolve):
    root = lxml.html.fragment_fromstring(html, create_parent="div")
    # short description
    desc = ""
    sd = css(root, ".shortdescription")
    if sd:
        desc = text_of(sd[0])
    # drop end sections
    for h2 in root.iter("h2"):
        name = text_of(h2).lower()
        if name in DROP_SECTIONS:
            sec = h2.getparent()
            while sec is not None and sec.tag != "section":
                sec = sec.getparent()
            if sec is not None:
                sec.set("data-drop", "1")
    for sec in [s for s in root.iter("section") if s.get("data-drop")]:
        remove(sec)
    # navboxes -> compact structure
    navs = []
    nav_ids = []
    seen_nav = set()
    for sel in NAV_SEL:
        for nb in css(root, sel):
            if nb.getparent() is None:
                continue
            if nb.get("class", "").find("navbox-styles") >= 0:
                remove(nb)
                continue
            title_el = css(nb, ".navbox-title") or css(nb, ".sidebar-title") or css(nb, "caption")
            title = text_of(title_el[0]) if title_el else ""
            title = re.sub(r"^\s*v\s*t\s*e\s*", "", title)
            groups = []
            rows = css(nb, "tr")
            for tr in rows:
                g = css(tr, ".navbox-group")
                lst = css(tr, ".navbox-list") or css(tr, ".sidebar-content") or css(tr, ".sidebar-list")
                if not lst:
                    continue
                ids = []
                for a in css(lst[0], "a"):
                    t = link_title(a)
                    if not t:
                        continue
                    i = resolve(t, "mw-redirect" in (a.get("class") or ""))
                    if i is not None and i not in ids:
                        ids.append(i)
                if ids:
                    groups.append([text_of(g[0]) if g else "", ids])
            # dedupe nested lists: a nested navbox list contains child rows too
            flat = []
            gseen = set()
            for gname, ids in groups:
                ids2 = [x for x in ids if (gname, x) not in gseen]
                for x in ids2:
                    gseen.add((gname, x))
                if ids2:
                    flat.append([gname, ids2])
            if flat:
                key = (title, tuple(tuple(x[1]) for x in flat))
                if key not in seen_nav:
                    seen_nav.add(key)
                    navs.append({"t": title, "g": flat})
                    for _, ids in flat:
                        for x in ids:
                            if x not in nav_ids:
                                nav_ids.append(x)
            remove(nb)
    for sel in DROP_SEL:
        for el in css(root, sel):
            if el.getparent() is not None:
                remove(el)
    # comments
    for c in root.xpath("//comment()"):
        remove(c)
    # display:none elements
    for el in root.xpath("//*[@style]"):
        st = (el.get("style") or "").replace(" ", "").lower()
        if "display:none" in st and el.getparent() is not None:
            remove(el)
    # figures: keep only caption
    for fig in list(root.iter("figure")):
        cap = css(fig, "figcaption")
        if not cap or not text_of(cap[0]):
            remove(fig)
            continue
        for k in list(fig):
            if k.tag != "figcaption":
                remove(k)
        fig.text = None
    # infobox: drop rows that became empty (images)
    for tr in css(root, "table.infobox tr"):
        if not text_of(tr):
            remove(tr)
    body_ids = []
    # links
    for a in list(root.iter("a")):
        href = a.get("href") or ""
        cls = a.get("class") or ""
        if href.startswith("#"):
            for k in list(a.attrib):
                del a.attrib[k]
            a.set("f", urllib.parse.unquote(href[1:]))
            continue
        t = link_title(a) if "mw-selflink" not in cls else None
        i = resolve(t, "mw-redirect" in cls) if t else None
        if i is None:
            unwrap(a)
            continue
        for k in list(a.attrib):
            del a.attrib[k]
        a.set("i", str(i))
        if i not in body_ids:
            body_ids.append(i)
    # tags + attributes
    for el in list(root.iter()):
        if not isinstance(el.tag, str):
            continue
        tag = el.tag.split("}")[-1]
        if el is root:
            continue
        if tag in ("section", "span", "font", "center", "label", "small") and tag not in KEEP_TAGS:
            keep_span = tag == "span" and any(c in KEEP_CLASS for c in (el.get("class") or "").split())
            if not keep_span:
                unwrap(el)
                continue
        if tag not in KEEP_TAGS and tag != "span":
            if tag in ("img", "input", "button", "svg", "iframe", "object", "embed", "form", "map", "area", "source", "track"):
                remove(el)
            else:
                unwrap(el)
            continue
        keep = {}
        for k, v in el.attrib.items():
            if k == "class":
                cl = [c for c in v.split() if c in KEEP_CLASS]
                if cl:
                    keep["class"] = " ".join(cl)
            elif k == "id" and tag in ("h2", "h3", "h4", "h5"):
                keep["id"] = v
            elif k in ("i", "f") and tag == "a":
                keep[k] = v
            elif k in KEEP_ATTR and (tag in MATH or k in ("colspan", "rowspan", "scope")):
                keep[k] = v
        el.attrib.clear()
        for k, v in keep.items():
            el.set(k, v)
    # unwrap meaningless divs
    for el in list(root.iter("div")):
        if el is root:
            continue
        if not el.get("class"):
            unwrap(el)
    # empty paragraphs / lists
    changed = True
    while changed:
        changed = False
        for el in list(root.iter("p", "li", "ul", "ol", "dl", "dd", "dt", "div", "table", "tr", "td", "th", "figure", "blockquote", "b", "i")):
            if el is root or el.getparent() is None:
                continue
            if el.tag in ("td", "th") and el.getparent() is not None:
                continue
            if not text_of(el) and not len(el.xpath(".//math|.//br|.//hr")):
                remove(el)
                changed = True
    # headings with no content after them are fine
    # extract: first paragraph with real text
    extract = ""
    for p in root.iter("p"):
        t = text_of(p)
        if len(t) > 60:
            t = re.sub(r"\s*\([^()]*\)", "", t) if len(t) > 400 else t
            extract = t[:420].rsplit(" ", 1)[0] + "..." if len(t) > 420 else t
            break
    out = etree.tostring(root, encoding="unicode", method="html")
    out = out[len("<div>"):-len("</div>")] if out.startswith("<div>") else out
    out = re.sub(r"\n\s*\n+", "\n", out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return {"desc": desc, "extract": extract, "html": out.strip(), "nav": navs, "body_ids": body_ids, "nav_ids": nav_ids}
