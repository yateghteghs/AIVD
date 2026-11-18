#!/usr/bin/env python3
"""
Ingest INEC guideline documents into data/guidelines.js.

    python3 scripts/ingest_guidelines.py --src-dir sources/ --download
    python3 scripts/ingest_guidelines.py --src-dir sources/ --only reg2026

Documents and their metadata (year, legal basis, current/dated) come from
scripts/guidelines_manifest.json. For each PDF:

  1. Use the text layer if it has one; otherwise OCR each page with Tesseract
     (pdftoppm at 300 dpi, word positions from TSV output, cached).
  2. Drop the right-hand marginal-note column when there is one, so headings
     printed in the margin don't get mixed into the text.
  3. Split into records: numbered paragraphs ("26. ...") for regulations,
     otherwise paragraphs merged into chunks of a few hundred characters.
  4. Write data/guidelines.js. OCR'd records are marked ocr: true and
     verified: false until someone proofreads them against the PDF.

The Electoral Act stays the controlling source; guidelines are shown as
supporting INEC guidance with their year and status.

Needs: poppler (pdftotext, pdftoppm), pdfplumber, and for scanned PDFs
tesseract-ocr (`apt-get install tesseract-ocr`).
"""
import argparse
import collections
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from ingest_act import topic_for  # noqa: E402

MIN_TEXT_CHARS_PER_PAGE = 200


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "aivd-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


# ---------------------------------------------------------------------------
# Word extraction: every page becomes a list of lines
#   {"top": y, "x0": x, "text": str, "par": paragraph-key}
# with page width, so later steps don't care whether it came from OCR.
# ---------------------------------------------------------------------------

def text_layer_pages(pdf_path):
    import pdfplumber  # type: ignore
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            words = p.extract_words(keep_blank_chars=False, use_text_flow=True)
            pages.append({"width": p.width, "height": p.height, "words": [
                {"x0": w["x0"], "x1": w["x1"], "top": w["top"], "text": w["text"], "h": w["bottom"] - w["top"]}
                for w in words]})
    return pages


def ocr_page(png, tsv_base):
    env = dict(os.environ, OMP_THREAD_LIMIT="1")
    if not os.path.exists(tsv_base + ".tsv"):
        subprocess.run(["tesseract", png, tsv_base, "-l", "eng", "--psm", "3", "tsv"],
                       check=True, capture_output=True, env=env)
    words = []
    with open(tsv_base + ".tsv", encoding="utf-8", errors="replace") as f:
        next(f, None)
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) < 12 or not c[11].strip():
                continue
            try:
                conf = float(c[10])
            except ValueError:
                continue
            if conf < 0:
                continue
            x, y, w, h = int(c[6]), int(c[7]), int(c[8]), int(c[9])
            words.append({"x0": x, "x1": x + w, "top": y, "h": h, "text": c[11],
                          "key": (int(c[2]), int(c[3]), int(c[4])), "conf": conf})
    return words


def ocr_number_column(png, tsv_base, frac=0.14):
    """Second pass over the left strip only, digits and dots, to recover paragraph
    numbers that full-page OCR sometimes drops."""
    from PIL import Image  # type: ignore
    out = tsv_base + "-nums"
    if not os.path.exists(out + ".tsv"):
        with Image.open(png) as im:
            w, h = im.size
            strip = out + ".png"
            im.crop((0, 0, int(w * frac), h)).save(strip)
        env = dict(os.environ, OMP_THREAD_LIMIT="1")
        subprocess.run(["tesseract", strip, out, "-l", "eng", "--psm", "6", "tsv"],
                       check=True, capture_output=True, env=env)
    nums = []
    with open(out + ".tsv", encoding="utf-8", errors="replace") as f:
        next(f, None)
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) >= 12 and re.fullmatch(r"\d{1,3}\.", c[11].strip() or "") and float(c[10]) > 50:
                nums.append({"x0": int(c[6]), "x1": int(c[6]) + int(c[8]), "top": int(c[7]), "h": int(c[9]),
                             "text": c[11].strip(), "key": (900, int(c[7]), 0), "conf": float(c[10]), "num": True})
    return nums


def ocr_pages(pdf_path, cache_dir, workers, numbered=False):
    if not shutil.which("tesseract"):
        sys.exit("%s has no text layer and tesseract is not installed (apt-get install tesseract-ocr)." % pdf_path)
    base = os.path.join(cache_dir, os.path.splitext(os.path.basename(pdf_path))[0])
    os.makedirs(cache_dir, exist_ok=True)
    page_png = re.compile(re.escape(os.path.basename(base)) + r"-\d+\.png$")
    pngs = sorted(f for f in os.listdir(cache_dir) if page_png.match(f))
    if not pngs:
        subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", pdf_path, base], check=True)
        pngs = sorted(f for f in os.listdir(cache_dir) if page_png.match(f))
    from PIL import Image  # type: ignore
    jobs = []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for png in pngs:
            full = os.path.join(cache_dir, png)
            jobs.append((full, ex.submit(ocr_page, full, full[:-4]),
                         ex.submit(ocr_number_column, full, full[:-4]) if numbered else None))
        pages = []
        for full, fut, nfut in jobs:
            with Image.open(full) as im:
                w, h = im.size
            words = fut.result()
            if nfut is not None:
                # add numbers the full-page pass missed (none already within half a line of them)
                for n in nfut.result():
                    same = [wd for wd in words if abs(wd["top"] - n["top"]) < 0.5 * max(n["h"], wd["h"])
                            and wd["x0"] < n["x1"] and wd["x1"] > n["x0"]]
                    if any(re.match(r"^\d", wd["text"]) for wd in same):
                        continue
                    short = [wd for wd in same if len(wd["text"]) <= 4]
                    if short:                      # full-page OCR misread the number (e.g. "77." as "TT.")
                        short[0]["text"] = n["text"]
                    elif not same:
                        words.append(n)
            pages.append({"width": w, "height": h, "words": words})
    return pages


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

def detect_margin_split(pages):
    """x where a right-hand marginal-note column starts (same idea as ingest_act)."""
    words = [w for p in pages for w in p["words"]]
    width = max((p["width"] for p in pages), default=0)
    if not words or not width:
        return None
    total, best, straddles = len(words), None, []
    step = max(1, int(width / 300))
    for x in range(int(width * 0.6), int(width * 0.9), step):
        straddle = sum(1 for w in words if w["x0"] < x < w["x1"])
        right = sum(1 for w in words if w["x0"] >= x)
        straddles.append(straddle)
        if 0.01 * total <= right <= 0.2 * total and (best is None or straddle < best[1]):
            best = (x, straddle)
    if not best:
        return None
    straddles.sort()
    median = straddles[len(straddles) // 2] or 1
    return best[0] if best[1] <= 0.2 * median else None


def page_lines(page, split, ocr):
    """Body lines of a page in reading order, with a paragraph key."""
    words = [w for w in page["words"] if split is None or w["x0"] < split]
    if not words:
        return []
    lines = []
    if ocr:
        # Tesseract (psm 3) already orders blocks/paragraphs/lines for reading,
        # including multi-column pages.
        groups = collections.OrderedDict()
        for w in words:
            groups.setdefault(w["key"], []).append(w)
        for key, ws in groups.items():
            ws.sort(key=lambda w: w["x0"])
            lines.append({"top": min(w["top"] for w in ws), "x0": ws[0]["x0"],
                          "h": max(w["h"] for w in ws), "par": key[:2],
                          "text": " ".join(w["text"] for w in ws)})
    else:
        words.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
        cur = None
        for w in words:
            if cur and abs(w["top"] - cur["top"]) <= max(2.5, 0.4 * w["h"]):
                cur["ws"].append(w)
            else:
                cur = {"top": w["top"], "ws": [w]}
                lines.append(cur)
        out = []
        for l in lines:
            ws = sorted(l["ws"], key=lambda w: w["x0"])
            out.append({"top": l["top"], "x0": ws[0]["x0"], "h": max(w["h"] for w in ws),
                        "text": " ".join(w["text"] for w in ws), "par": None})
        lines = out
        # paragraph breaks from vertical gaps
        gaps = [b["top"] - a["top"] for a, b in zip(lines, lines[1:]) if b["top"] > a["top"]]
        typical = sorted(gaps)[len(gaps) // 2] if gaps else 12
        par = 0
        for i, l in enumerate(lines):
            if i and l["top"] - lines[i - 1]["top"] > 1.6 * typical:
                par += 1
            l["par"] = (0, par)
    return lines


def merge_same_row(lines):
    """For numbered documents: put a paragraph number OCR'd as its own block back on its
    text line. Lines whose tops are within ~half a line height share a row and are
    joined left to right, whichever one the OCR saw first."""
    rows = []
    for l in sorted(lines, key=lambda l: (l["top"], l["x0"])):
        if rows and abs(l["top"] - rows[-1][0]["top"]) <= 0.6 * max(l["h"], rows[-1][0]["h"]):
            rows[-1].append(l)
        else:
            rows.append([l])
    out = []
    for row in rows:
        row.sort(key=lambda l: l["x0"])
        m = dict(row[0])
        m["text"] = " ".join(l["text"] for l in row)
        m["top"] = min(l["top"] for l in row)
        m["h"] = max(l["h"] for l in row)
        out.append(m)
    return out


def clean(text):
    text = text.replace("­", "")
    # Re-join words split across lines, but keep real hyphens after common prefixes
    # ("non-replacement", "re-run", "off-cycle").
    text = re.sub(r"\b(non|Non|self|co|anti|post|pre|multi|by|re|Re|off|Off|sub)-\s+(\w)", r"\1-\2", text)
    text = re.sub(r"(\w)- (\w)", r"\1\2", text)
    text = re.sub(r"\s+([,.;:)])", r"\1", text)
    text = re.sub(r"\(\s+", "(", text)
    return re.sub(r"\s+", " ", text).strip()


def is_noise(line, page_height):
    t = line["text"].strip()
    return (not t or re.fullmatch(r"[\W_]{1,4}|\d{1,3}|[ivxlc]{1,6}\.?", t, re.I) is not None
            or re.fullmatch(r"(www\.)?inecnigeria\.org", t, re.I) is not None)


# ---------------------------------------------------------------------------
# Structuring
# ---------------------------------------------------------------------------

RE_NUM = re.compile(r"^(\d{1,3})\s?[.,](?:\s+(.*))?$")


def margin_notes(page, split, ocr):
    """Lines in the right-hand marginal-note column (headings printed beside each paragraph)."""
    if split is None:
        return []
    side = dict(page, words=[w for w in page["words"] if w["x0"] >= split])
    return page_lines(side, None, ocr)


def numbered_records(doc, pages_lines, page_width, notes_by_page=None):
    """Split on numbered paragraphs. Titles come from the marginal note beside each
    paragraph, falling back to the table of contents."""
    flat = []
    for pno, lines in pages_lines:
        for l in merge_same_row(lines):
            flat.append((pno, l))
    left_limit = 0.2 * page_width

    def parse_from(start):
        recs, prev = [], None
        for pno, l in flat[start:]:
            m = RE_NUM.match(l["text"])
            if m and l["x0"] < left_limit:
                n = int(m.group(1))
                if (prev is None and n == 1) or (prev is not None and prev < n <= prev + 3):
                    recs.append({"num": n, "page": pno, "top": l["top"], "lines": [m.group(2) or ""]})
                    prev = n
                    continue
            if recs:
                recs[-1]["lines"].append(l["text"])
        return recs

    starts = [i for i, (_, l) in enumerate(flat) if RE_NUM.match(l["text"]) and RE_NUM.match(l["text"]).group(1) == "1"]
    # The body is the run starting at "1." with the most text; the table of
    # contents is the longest run whose entries are short.
    best, best_chars, toc = None, -1, []
    for s in starts:
        recs = parse_from(s)
        chars = sum(len(" ".join(r["lines"])) for r in recs)
        if chars > best_chars:
            best, best_chars = recs, chars
        if recs and chars / len(recs) < 150 and len(recs) > len(toc):
            toc = recs
    titles = {r["num"]: clean(" ".join(r["lines"]))[:140] for r in toc}
    notes_by_page = notes_by_page or {}
    body = best or []
    for i, r in enumerate(body):
        nxt = body[i + 1] if i + 1 < len(body) else None
        limit = nxt["top"] if nxt and nxt["page"] == r["page"] else float("inf")
        cands = [n for n in sorted(notes_by_page.get(r["page"], []), key=lambda n: n["top"])
                 if r["top"] - 30 <= n["top"] < limit - 10]
        # keep the first contiguous block only (the heading): stop at the first vertical gap
        note = []
        for n in cands[:6]:
            if note and n["top"] - note[-1]["top"] > 1.9 * max(n["h"], note[-1]["h"]):
                break
            note.append(n)
        text = clean(" ".join(n["text"] for n in note))
        text = re.sub(r"[|=~_]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip(" -—")
        if 3 <= len(text) <= 160 and re.search(r"[A-Za-z]{3}", text):
            titles[r["num"]] = text

    out = []
    for r in best or []:
        text = clean(" ".join(r["lines"]))
        if not text:
            continue
        out.append({
            "id": "%s-%d" % (doc["id"], r["num"]),
            "ref": "%s %d" % (doc.get("refLabel", "para."), r["num"]),
            "num": r["num"],
            "title": titles.get(r["num"]) or ("%s %d" % (doc.get("refLabel", "para."), r["num"])).capitalize(),
            "text": text,
            "page": r["page"],
        })
    return out


def split_lettered(rec, min_len=1200):
    """Split a long numbered paragraph into its lettered sub-items (a), (b), ...
    Letters must run in order, so roman numerals like (i), (ii) inside an item stay put
    (unless the expected letter really is (i), which the order check handles)."""
    text = rec["text"]
    if len(text) < min_len:
        return [rec]
    cuts, expect = [], "a"
    for m in re.finditer(r"(?:(?<=\s)|^)\(([a-z])\)\s", text):
        # accept the expected letter, or the one after it (OCR sometimes drops a marker)
        if m.group(1) in (expect, chr(ord(expect) + 1)):
            cuts.append((m.start(), m.group(1)))
            expect = chr(ord(m.group(1)) + 1)
    if len(cuts) < 3:
        return [rec]
    out = []
    lead = text[:cuts[0][0]].strip()
    for i, (pos, letter) in enumerate(cuts):
        end = cuts[i + 1][0] if i + 1 < len(cuts) else len(text)
        body = text[pos:end].strip()
        if lead:
            body = lead + " … " + body
        out.append(dict(rec, id="%s-%s" % (rec["id"], letter), ref="%s(%s)" % (rec["ref"], letter), text=body))
    return out


def paragraph_records(doc, pages_lines, target=700):
    out, buf, buf_page, heading = [], [], None, None
    n = 0

    def flush():
        nonlocal buf, buf_page, n
        text = clean(" ".join(buf))
        if len(text) >= 40:
            n += 1
            out.append({"id": "%s-%d" % (doc["id"], n), "ref": "p. %d" % buf_page, "num": n,
                        "title": heading or doc["title"], "text": text, "page": buf_page})
        buf, buf_page = [], None

    for pno, lines in pages_lines:
        pars = collections.OrderedDict()
        for l in lines:
            pars.setdefault(l["par"], []).append(l["text"])
        for _, ls in pars.items():
            ptext = clean(" ".join(ls))
            if not ptext:
                continue
            short = len(ptext) < 70 and not re.search(r"[.;:,]$", ptext)
            if short and len(ls) <= 2:
                if buf:
                    flush()
                heading = ptext
                continue
            if buf and (buf_page != pno or len(" ".join(buf)) + len(ptext) > target):
                flush()
            if not buf:
                buf_page = pno
            buf.append(ptext)
    if buf:
        flush()
    return out


# ---------------------------------------------------------------------------

def ingest_doc(doc, path, cache_dir, workers, topic_map, proofread=None):
    proofread = proofread or {}
    pages = text_layer_pages(path)
    chars = sum(len(" ".join(w["text"] for w in p["words"])) for p in pages)
    ocr = chars < MIN_TEXT_CHARS_PER_PAGE * max(1, len(pages)) * 0.5
    if ocr:
        pages = ocr_pages(path, cache_dir, workers, numbered=doc.get("structure") == "numbered")
    split = detect_margin_split(pages)
    pages_lines = []
    for i, p in enumerate(pages, start=1):
        ls = [l for l in page_lines(p, split, ocr) if not is_noise(l, p["height"])]
        pages_lines.append((i, ls))
    # running headers/footers: lines that repeat (digits masked) on many pages
    mask = lambda t: re.sub(r"\d+", "#", t.strip().lower())
    counts = collections.Counter(m for _, ls in pages_lines for m in set(mask(l["text"]) for l in ls))
    repeated = {k for k, v in counts.items()
                if v >= max(3, 0.3 * len(pages_lines)) and len(k) < 120 and re.search(r"[a-z]{3}", k)}
    pages_lines = [(i, [l for l in ls if mask(l["text"]) not in repeated]) for i, ls in pages_lines]
    width = max(p["width"] for p in pages)
    if doc.get("structure") == "numbered":
        notes = {i: margin_notes(p, split, ocr) for i, p in enumerate(pages, start=1)}
        recs = [sub for r in numbered_records(doc, pages_lines, width, notes) for sub in split_lettered(r)]
    else:
        recs = paragraph_records(doc, pages_lines)
    for r in recs:
        r.update({"docId": doc["id"], "ocr": ocr, "verified": False if ocr else True,
                  "topic": topic_for(r["title"], r["text"], topic_map)})
        r.pop("num", None)
        check = proofread.get(r["id"])
        if check:
            if check.get("text"):
                r["text"] = check["text"]
            if check.get("title"):
                r["title"] = check["title"]
            r["proofread"] = {k: check[k] for k in ("by", "on", "method") if k in check}
            if check.get("verified"):
                r["verified"] = True
    info = {
        "id": doc["id"], "title": doc["title"], "short": doc.get("short", doc["title"]),
        "url": doc["url"], "year": doc.get("year"), "basis": doc.get("basis"),
        "status": doc.get("status", "current"), "note": doc.get("note"),
        "file": os.path.basename(path), "sha256": sha256(path), "pages": len(pages),
        "extraction": "ocr" if ocr else "text", "marginSplit": split, "records": len(recs),
    }
    return info, recs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src-dir", default=os.path.join(ROOT, "sources"), help="folder holding the PDFs")
    ap.add_argument("--download", action="store_true", help="download missing PDFs from the manifest URLs")
    ap.add_argument("--manifest", default=os.path.join(HERE, "guidelines_manifest.json"))
    ap.add_argument("--cache", help="OCR cache folder (default: <src-dir>/.ocr)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "guidelines.js"))
    ap.add_argument("--proofread", default=os.path.join(ROOT, "data", "proofread.json"),
                    help="corrections and proofreading records for OCR'd paragraphs")
    ap.add_argument("--only", help="comma-separated document ids")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    a = ap.parse_args()

    manifest = json.load(open(a.manifest, encoding="utf-8"))
    topic_map = json.load(open(os.path.join(HERE, "topic_map.json"), encoding="utf-8"))
    cache = a.cache or os.path.join(a.src_dir, ".ocr")
    proofread = {}
    if os.path.exists(a.proofread):
        proofread = {k: v for k, v in json.load(open(a.proofread, encoding="utf-8")).items() if not k.startswith("_")}
    os.makedirs(a.src_dir, exist_ok=True)
    only = set(a.only.split(",")) if a.only else None

    docs, records = [], []
    for doc in manifest["documents"]:
        if only and doc["id"] not in only:
            continue
        path = os.path.join(a.src_dir, os.path.basename(doc["url"]))
        if not os.path.exists(path):
            if not a.download:
                print("skip %s: %s not found (use --download)" % (doc["id"], path))
                continue
            print("downloading", doc["url"])
            download(doc["url"], path)
        info, recs = ingest_doc(doc, path, cache, a.workers, topic_map, proofread)
        docs.append(info)
        records.extend(recs)
        print("%-9s %-5s %3d pages -> %3d records%s" % (
            doc["id"], info["extraction"], info["pages"], len(recs),
            "  (margin column dropped at x=%s)" % info["marginSplit"] if info["marginSplit"] else ""))

    meta = {"generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "source": "https://inecnigeria.org/elections/guidelines", "documents": len(docs), "records": len(records)}
    body = ("/*\n * AIVD guidance corpus: INEC guideline documents. GENERATED by scripts/ingest_guidelines.py.\n"
            " * Records with ocr: true come from scanned pages and must be proofread before they are relied on.\n */\n")
    body += "var AIVD_GUIDE_META = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n\n"
    body += "var AIVD_GUIDE_DOCS = " + json.dumps(docs, indent=2, ensure_ascii=False) + ";\n\n"
    body += "var AIVD_GUIDELINES = " + json.dumps(records, indent=2, ensure_ascii=False) + ";\n\n"
    body += ("if (typeof module !== 'undefined' && module.exports) {\n"
             "  module.exports = { meta: AIVD_GUIDE_META, documents: AIVD_GUIDE_DOCS, guidelines: AIVD_GUIDELINES };\n}\n")
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(body)
    print("Wrote %s (%d documents, %d records)" % (a.out, len(docs), len(records)))


if __name__ == "__main__":
    main()
