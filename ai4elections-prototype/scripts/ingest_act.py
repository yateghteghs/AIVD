#!/usr/bin/env python3
"""
Ingest the official Electoral Act PDF into data/provisions.js.

    python3 scripts/ingest_act.py path/to/Electoral-Act-2026.pdf
    python3 scripts/ingest_act.py act.pdf --report ingest-report.json
    python3 scripts/ingest_act.py --from-text tests/fixtures/sample_act.txt --out /tmp/p.js

What it does
  1. Extracts text page by page (pdftotext from poppler, falling back to pdfplumber).
  2. Removes running headers/footers and page numbers.
  3. Skips the "Arrangement of Sections" table of contents.
  4. Splits the body into sections ("47.—(1) ...") and subsections ("(3) ..."),
     keeping Part headings, marginal notes (section titles) and page numbers.
  5. Tags each record with a topic (scripts/topic_map.json) and merges any
     reviewed summaries from data/summaries.json.
  6. Writes data/provisions.js with verified: true and the PDF's SHA-256,
     and prints a report of gaps and anomalies.

The official wording is copied, never rewritten. Always spot-check the
report and a sample of sections against the PDF before a demo.

Scanned PDFs (images, no text layer) need OCR first, e.g. `ocrmypdf in.pdf out.pdf`.
"""
import argparse
import collections
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

PAGE_BREAK = "\f"

RE_PART = re.compile(r"^PART\s+([IVXLC]+)\b\s*[—–-]*\s*(.*)$")
RE_SCHEDULE = re.compile(r"^(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH)?\s*SCHEDULES?\b")
# "47.—(1) A person", "47. The Commission", "47A.—(1)", "47. Title.—(1) text"
RE_SECTION = re.compile(r"^(\d{1,3}[A-Z]?)\s?\.\s*(?:[—–-]+\s*)?(?=\(\d|[A-Z\"“(])(.*)$")
# Only "Title.—(1) text" counts as an inline heading; "Any person who —" is body text.
RE_INLINE_TITLE = re.compile(r"^([A-Z][^.—–]{2,90}?)\.?\s*[—–]+\s*(\(1\).*)$")
RE_SUBSECTION = re.compile(r"^\((\d{1,2}[A-Z]?)\)\s*(.*)$")
RE_PAGE_NO = re.compile(r"^(?:[A-Z]\s?)?\d{1,4}$|^page\s+\d+(\s+of\s+\d+)?$", re.I)
RE_BODY_START = re.compile(r"\b(BE IT )?ENACTED\b|\[\s*Commencement\s*\]|\bCommencement\.?\s*\]", re.I)


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def extract_pages(pdf_path, layout=False):
    if shutil.which("pdftotext"):
        cmd = ["pdftotext", "-enc", "UTF-8"] + (["-layout"] if layout else []) + [pdf_path, "-"]
        out = subprocess.run(cmd, check=True, capture_output=True).stdout.decode("utf-8", "replace")
        pages = out.split(PAGE_BREAK)
        if pages and not pages[-1].strip():
            pages = pages[:-1]
        return pages
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        sys.exit("Need poppler's pdftotext or `pip install pdfplumber`.")
    with pdfplumber.open(pdf_path) as pdf:
        return [(p.extract_text() or "") for p in pdf.pages]


def detect_margin_split(pdf):
    """Find the x position of a right-hand marginal-note column, or None.

    Nigerian Acts print section headings in the right margin, level with the
    first line of the section. Plain text extraction interleaves them with the
    legal text ("...to a Presiding Accreditation of Officer..."). We look for a
    vertical gutter that almost no word crosses, with a thin column of words
    to its right.
    """
    words, width = [], None
    for p in pdf.pages:
        width = width or p.width
        words.extend(p.extract_words())
    if not words or not width:
        return None
    total = len(words)
    best = None
    straddles = []
    for x in range(int(width * 0.55), int(width * 0.92), 2):
        straddle = sum(1 for w in words if w["x0"] < x < w["x1"])
        right = sum(1 for w in words if w["x0"] >= x)
        straddles.append(straddle)
        if 0.01 * total <= right <= 0.25 * total and (best is None or straddle < best[1]):
            best = (x, straddle)
    if best is None:
        return None
    straddles.sort()
    median = straddles[len(straddles) // 2] or 1
    return best[0] if best[1] <= 0.05 * median else None


def extract_pages_columns(pdf_path, split=None):
    """Body text only (left of the marginal-note column) plus the split used."""
    import pdfplumber  # type: ignore
    with pdfplumber.open(pdf_path) as pdf:
        if split is None:
            split = detect_margin_split(pdf)
        if not split:
            return None, None
        pages = []
        for p in pdf.pages:
            pages.append(p.crop((0, 0, min(split, p.width), p.height)).extract_text() or "")
        return pages, split


def parse_toc(cleaned):
    """Section titles from the 'Arrangement of Sections' (before the enacted body)."""
    pi0, li0 = find_body_start(cleaned)
    titles, last = {}, None
    for pi, (_, lines) in enumerate(cleaned):
        if pi > pi0:
            break
        for li, l in enumerate(lines):
            if pi == pi0 and li >= li0:
                break
            m = re.match(r"^(\d{1,3}[A-Z]?)\.\s+([A-Z].*)$", l)
            if m:
                last = m.group(1)
                titles[last] = m.group(2).strip()
            elif last and l and l[:1].islower():
                titles[last] += " " + l.strip()
            elif not l or RE_PART.match(l):
                last = None
    return titles


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------

def clean_pages(pages):
    """Return list of (page_no, [lines]) with headers/footers removed."""
    split = [[ln.rstrip() for ln in p.splitlines()] for p in pages]
    # Lines that repeat (digits masked) on many pages are running headers/footers.
    # Only the first/last few non-empty lines of a page are header/footer candidates,
    # so repeated body wording ("... shall apply") is never dropped.
    EDGE = 2

    def edges(lines):
        ne = [l.strip() for l in lines if l.strip()]
        return ne[:EDGE] + ne[-EDGE:]

    counts = collections.Counter()
    for lines in split:
        for ln in set(re.sub(r"\d+", "#", l) for l in edges(lines)):
            counts[ln] += 1
    threshold = max(3, int(len(split) * 0.5))
    repeated = {k for k, v in counts.items() if v >= threshold and len(k) < 120}
    out = []
    for i, lines in enumerate(split, start=1):
        kept = []
        edge = set(edges(lines))
        for l in lines:
            s = l.strip()
            if not s:
                kept.append("")
                continue
            if s in edge and not RE_SECTION.match(s) and not RE_SUBSECTION.match(s) and (
                    RE_PAGE_NO.match(s) or re.sub(r"\d+", "#", s) in repeated):
                continue
            kept.append(s)
        out.append((i, kept))
    return out


def find_body_start(cleaned):
    """(page_index, line_index) where the enacted body starts, skipping the table of contents."""
    for pi, (_, lines) in enumerate(cleaned):
        for li, l in enumerate(lines):
            if RE_BODY_START.search(l):
                return pi, li
    # Fallback: the last line that starts section 1 (the first is usually the ToC).
    last = None
    for pi, (_, lines) in enumerate(cleaned):
        for li, l in enumerate(lines):
            m = RE_SECTION.match(l)
            if m and m.group(1) == "1":
                last = (pi, li)
    return last or (0, 0)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def sec_key(num):
    m = re.match(r"(\d+)([A-Z]?)", num)
    return int(m.group(1)), m.group(2)


def plausible_next(prev, cand, max_gap):
    """Accept a section number only if it follows the previous one (47 -> 48, 47 -> 47A, small gaps)."""
    cn, cl = sec_key(cand)
    if prev is None:
        return cn <= max_gap
    pn, pl = sec_key(prev)
    if cn == pn:
        return bool(cl) and cl > pl
    return pn < cn <= pn + max_gap


def looks_like_title(line):
    if not line or len(line) > 90:
        return False
    if line[-1] in ".;:," or RE_SUBSECTION.match(line) or RE_SECTION.match(line):
        return False
    if re.match(r"^\(?[a-z]{1,4}\)", line):    # (a) paragraph
        return False
    return line[0].isupper()


def parse(cleaned, max_gap=3):
    pi0, li0 = find_body_start(cleaned)
    sections, anomalies = [], []
    part = None
    cur = None
    prev_num = None
    pending_title = None
    stop = False

    for pi in range(pi0, len(cleaned)):
        page_no, lines = cleaned[pi]
        start = li0 if pi == pi0 else 0
        for li in range(start, len(lines)):
            line = lines[li]
            if not line:
                continue
            if RE_SCHEDULE.match(line) and sections:
                stop = True
                break
            mp = RE_PART.match(line)
            if mp:
                title = mp.group(2).strip()
                # Part headings are in capitals and may wrap onto following lines.
                nxt = li + 1
                while nxt < len(lines) and lines[nxt] and lines[nxt] == lines[nxt].upper() \
                        and re.search(r"[A-Z]{3}", lines[nxt]) and not RE_SECTION.match(lines[nxt]) \
                        and not RE_PART.match(lines[nxt]) and len(title) < 150:
                    title = (title + " " + lines[nxt].strip()).strip()
                    nxt += 1
                part = ("Part " + mp.group(1) + (" — " + title.title() if title else "")).strip()
                pending_title = None
                continue
            ms = RE_SECTION.match(line)
            if ms and plausible_next(prev_num, ms.group(1), max_gap):
                num, rest = ms.group(1), ms.group(2).strip()
                if prev_num is not None:
                    gap = sec_key(num)[0] - sec_key(prev_num)[0]
                    if gap > 1:
                        anomalies.append({"kind": "gap", "after": prev_num, "before": num, "page": page_no})
                title = None
                mi = RE_INLINE_TITLE.match(rest)
                if mi and not rest.startswith("("):
                    title, rest = mi.group(1).strip(), mi.group(2).strip()
                if not title and pending_title:
                    title = pending_title
                    # Remove the marginal note we already appended to the previous section.
                    if cur and cur["lines"] and cur["lines"][-1] == pending_title:
                        cur["lines"].pop()
                cur = {"section": num, "title": title, "part": part, "page": page_no, "lines": [rest] if rest else []}
                sections.append(cur)
                prev_num = num
                pending_title = None
                continue
            if cur is not None:
                cur["lines"].append(line)
            pending_title = line if looks_like_title(line) else None
        if stop:
            break

    if not sections:
        anomalies.append({"kind": "no_sections_found"})
    return sections, anomalies


def join_lines(lines):
    text = ""
    for l in lines:
        if text.endswith("-") and l[:1].islower():
            text = text[:-1] + l          # de-hyphenate "elec-\ntion"
        else:
            text = (text + " " + l) if text else l
    return re.sub(r"\s+", " ", text).strip()


def split_subsections(sec):
    """Yield (subsection_number_or_None, text). Only sequential (1), (2), ... at line starts split."""
    chunks, cur_no, buf, expected = [], None, [], 1
    for l in sec["lines"]:
        m = RE_SUBSECTION.match(l)
        if m and re.match(r"\d+", m.group(1)) and int(re.match(r"\d+", m.group(1)).group()) == expected:
            if buf:
                chunks.append((cur_no, buf))
            cur_no, buf, expected = m.group(1), [m.group(2)], expected + 1
        else:
            buf.append(l)
    if buf:
        chunks.append((cur_no, buf))
    if len(chunks) > 1 and chunks[0][0] is None and not join_lines(chunks[0][1]):
        chunks = chunks[1:]
    return [(n, join_lines(b)) for n, b in chunks if join_lines(b)]


def topic_for(title, text, topic_map):
    t, x = (title or "").lower(), text.lower()
    best, best_score = None, 0
    for topic, kws in topic_map.items():
        if topic.startswith("_"):
            continue
        score = sum(3 * t.count(k) + x.count(k) for k in kws)
        if score > best_score:
            best, best_score = topic, score
    return best


def build_records(sections, topic_map, summaries, toc=None, extra_keywords=None):
    extra_keywords = extra_keywords or {}
    recs, seen = [], set()
    toc = toc or {}
    for s in sections:
        if s["section"] in toc:
            s["title"] = toc[s["section"]]
        subs = split_subsections(s)
        for sub_no, text in subs:
            rid = "s%s-%s" % (s["section"], sub_no) if sub_no else "s%s" % s["section"]
            if rid in seen:
                rid += "-dup"
            seen.add(rid)
            rec = {
                "id": rid,
                "section": s["section"],
                "subsection": sub_no,
                "part": s["part"],
                "title": s["title"] or ("Section %s" % s["section"]),
                "text": text,
                "keywords": [w for w in re.findall(r"[a-z]+", (s["title"] or "").lower()) if len(w) > 3],
                "topic": topic_for(s["title"], text, topic_map),
                "page": s["page"],
                "verified": True,
            }
            for kw in extra_keywords.get(rid, []):
                if kw not in rec["keywords"]:
                    rec["keywords"].append(kw)
            summ = summaries.get(rid)
            if summ:
                if summ.get("en"):
                    rec["summary_en"] = summ["en"]
                if summ.get("pcm"):
                    rec["summary_pcm"] = summ["pcm"]
            recs.append(rec)
    return recs


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_js(path, meta, records):
    body = (
        "/*\n * AIVD provisions corpus — GENERATED by scripts/ingest_act.py. Do not edit by hand.\n"
        " * Source: %s (sha256 %s)\n * Generated: %s\n */\n"
        % (meta["source"]["file"], meta["source"]["sha256"], meta["generatedAt"])
    )
    body += "var AIVD_META = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n\n"
    body += "var AIVD_PROVISIONS = " + json.dumps(records, indent=2, ensure_ascii=False) + ";\n\n"
    body += "if (typeof module !== 'undefined' && module.exports) {\n  module.exports = { meta: AIVD_META, provisions: AIVD_PROVISIONS };\n}\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", nargs="?", help="official Electoral Act PDF")
    ap.add_argument("--from-text", help="parse a plain-text file instead (pages separated by form feeds)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "provisions.js"))
    ap.add_argument("--act-name", default="Electoral Act 2026")
    ap.add_argument("--layout", action="store_true", help="use pdftotext -layout (try if marginal notes are lost)")
    ap.add_argument("--margin-x", type=float, help="x (points) where the marginal-note column starts; auto-detected if omitted")
    ap.add_argument("--no-columns", action="store_true", help="disable marginal-column detection")
    ap.add_argument("--max-gap", type=int, default=3, help="largest jump in section numbers accepted as real")
    ap.add_argument("--summaries", default=os.path.join(ROOT, "data", "summaries.json"))
    ap.add_argument("--report", help="write the ingest report as JSON")
    ap.add_argument("--dry-run", action="store_true", help="parse and report without writing provisions.js")
    a = ap.parse_args()

    if not a.pdf and not a.from_text:
        ap.error("give a PDF path or --from-text")
    src = a.pdf or a.from_text
    if a.from_text:
        with open(a.from_text, encoding="utf-8") as f:
            pages = f.read().split(PAGE_BREAK)
    else:
        pages, split = (None, None)
        if not a.layout and not a.no_columns:
            try:
                pages, split = extract_pages_columns(a.pdf, a.margin_x)
            except ImportError:
                pages = None
        if pages:
            print("Marginal-note column detected at x=%s pt; using body text only." % split)
        else:
            pages = extract_pages(a.pdf, layout=a.layout)

    chars = sum(len(p.strip()) for p in pages)
    if chars < 200 * max(1, len(pages)) * 0.2:
        sys.exit("Very little text extracted (%d chars over %d pages). The PDF is probably scanned: run OCR first (e.g. `ocrmypdf in.pdf out.pdf`)." % (chars, len(pages)))

    with open(os.path.join(HERE, "topic_map.json"), encoding="utf-8") as f:
        topic_map = json.load(f)
    summaries = {}
    if os.path.exists(a.summaries):
        with open(a.summaries, encoding="utf-8") as f:
            summaries = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    cleaned = clean_pages(pages)
    sections, anomalies = parse(cleaned, max_gap=a.max_gap)
    toc = parse_toc(cleaned)
    kw_path = os.path.join(ROOT, "data", "keywords.json")
    extra_keywords = {}
    if os.path.exists(kw_path):
        with open(kw_path, encoding="utf-8") as f:
            extra_keywords = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    records = build_records(sections, topic_map, summaries, toc, extra_keywords)

    for s in sections:
        if not s["title"]:
            anomalies.append({"kind": "missing_title", "section": s["section"], "page": s["page"]})
    for r in records:
        if len(r["text"]) < 25:
            anomalies.append({"kind": "very_short", "id": r["id"], "page": r["page"]})
        if len(r["text"]) > 4000:
            anomalies.append({"kind": "very_long", "id": r["id"], "page": r["page"], "hint": "subsections may not have split"})
    orphan_summaries = sorted(set(summaries) - {r["id"] for r in records})
    for o in orphan_summaries:
        anomalies.append({"kind": "summary_without_provision", "id": o})

    meta = {
        "actName": a.act_name,
        "corpus": "official",
        "verified": bool(a.pdf),
        "source": {
            "file": os.path.basename(src),
            "sha256": sha256(src),
            "pages": len(pages),
        },
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sections": len(sections),
        "records": len(records),
    }
    if a.from_text:
        meta["corpus"] = "text-fixture"
        for r in records:
            r["verified"] = False

    report = {"meta": meta, "anomalies": anomalies,
              "topics": collections.Counter(r["topic"] or "none" for r in records)}
    if not a.dry_run:
        write_js(a.out, meta, records)
    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

    first = sections[0]["section"] if sections else "-"
    last = sections[-1]["section"] if sections else "-"
    print("Parsed %d sections (s.%s to s.%s) into %d records from %d pages." % (len(sections), first, last, len(records), len(pages)))
    print("Topics: " + ", ".join("%s=%d" % kv for kv in sorted(report["topics"].items())))
    kinds = collections.Counter(x["kind"] for x in anomalies)
    print("Anomalies: " + (", ".join("%s=%d" % kv for kv in kinds.items()) if kinds else "none"))
    for x in anomalies[:25]:
        print("  - " + json.dumps(x, ensure_ascii=False))
    if len(anomalies) > 25:
        print("  ... %d more (use --report)" % (len(anomalies) - 25))
    print(("Dry run: nothing written." if a.dry_run else "Wrote " + a.out))
    if not any(r["id"].startswith("s47-") for r in records):
        print("WARNING: no s.47 subsections found; the Section 47(3) conflict panel will have no Act text.")


if __name__ == "__main__":
    main()
