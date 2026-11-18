#!/usr/bin/env python3
"""Checks scripts/ingest_act.py against the synthetic fixture (tests/fixtures/sample_act.*)."""
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
fixture_dir = os.path.join(HERE, "fixtures")
src = os.path.join(fixture_dir, "sample_act.pdf")
if not os.path.exists(src):
    src = None
args = [src] if src else ["--from-text", os.path.join(fixture_dir, "sample_act.txt")]

with tempfile.TemporaryDirectory() as d:
    out, rep = os.path.join(d, "p.js"), os.path.join(d, "r.json")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "ingest_act.py"), *args, "--out", out, "--report", rep,
                    "--summaries", os.path.join(d, "none.json")], check=True, capture_output=True)
    js = open(out, encoding="utf-8").read()
    recs = json.loads(js.split("var AIVD_PROVISIONS = ", 1)[1].split(";\n\nif (typeof module", 1)[0])
    report = json.load(open(rep))

by = {r["id"]: r for r in recs}
checks = [
    ("48 sections parsed", report["meta"]["sections"] == 48),
    ("no anomalies", report["anomalies"] == []),
    ("table of contents skipped (s.1 not on page 1)", by["s1"]["page"] > 1),
    ("schedule not parsed as a section", all("Schedule paragraph" not in r["text"] for r in recs)),
    ("s.47 split into 3 subsections", all(k in by for k in ("s47-1", "s47-2", "s47-3"))),
    ("s.47(3) text intact", by["s47-3"]["text"].startswith("Where the sample device fails")),
    ("marginal note captured as title", by["s47-3"]["title"] == "Accreditation of sample voters"),
    ("marginal note not left in previous section", "Accreditation of sample" not in by["s46"]["text"]),
    ("de-hyphenation", "liable on conviction" in by["s12"]["text"]),
    ("page header removed", all("Gazette" not in r["text"] for r in recs)),
    ("Part heading tracked", by["s47-3"]["part"].startswith("Part II")),
    ("topic tagging", by["s47-3"]["topic"] == "accreditation" and by["s12"]["topic"] == "offences"),
]
fails = [n for n, ok in checks if not ok]
for n, ok in checks:
    print(("PASS  " if ok else "FAIL  ") + n)
print("\nIngest checks: %d/%d (%s)" % (len(checks) - len(fails), len(checks), "pdf" if src else "text"))
sys.exit(1 if fails else 0)
