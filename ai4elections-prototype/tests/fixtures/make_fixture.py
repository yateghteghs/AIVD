#!/usr/bin/env python3
"""Build a synthetic 'Sample Act' (NOT LAW) as .txt and .pdf to exercise scripts/ingest_act.py.

It mimics the layout of a Nigerian Act: arrangement of sections (table of contents),
running header, page numbers, Parts, marginal notes, '47.—(1)' numbering,
hyphenated line breaks and a Schedule."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))

def build():
    toc = ["SAMPLE ACT FOR PARSER TESTING (NOT LAW)", "ARRANGEMENT OF SECTIONS", "PART I — PRELIMINARY"]
    def heading(n):
        return {47: "Accreditation of sample voters", 12: "Sample offence"}.get(n, "Sample matter %s%s" % (chr(65 + n % 26), chr(65 + n // 26)))
    toc += ["%d. %s" % (n, heading(n)) for n in range(1, 49)]
    body = ["SAMPLE ACT FOR PARSER TESTING (NOT LAW)", "BE IT ENACTED by the Sample Assembly as follows:", "PART I", "PRELIMINARY"]
    for n in range(1, 49):
        if n == 40:
            body += ["PART II — ACCREDITATION AND VOTING"]
        if n == 47:
            body += [
                "Accreditation of sample voters",
                "47.—(1) A sample voter shall present a sample card to the sample officer at the sample unit in",
                "which the name is registered.",
                "(2) The sample officer shall use a sample device to verify the sample voter.",
                "(3) Where the sample device fails to function in a sample unit and is not replaced, the sample",
                "poll in that unit shall be treated as the sample rules provide.",
            ]
        elif n == 12:
            body += ["Sample offence", "12. A sample person who gives a sample inducement to a sample voter commits a sample offence and is liable on convic-", "tion to a sample fine."]
        else:
            body += ["Sample matter %s%s" % (chr(65 + n % 26), chr(65 + n // 26)), "%d. The sample text of section %d applies to sample matters only." % (n, n)]
    body += ["FIRST SCHEDULE", "1. Schedule paragraph that must not be parsed as section 1."]
    lines = toc + body
    pages, per = [], 22
    for i in range(0, len(lines), per):
        pg = i // per + 1
        pages.append("\n".join(["Sample Act Gazette No. %d" % pg] + lines[i:i + per] + ["", "A %d" % (100 + pg)]))
    return pages

if __name__ == "__main__":
    pages = build()
    with open(os.path.join(HERE, "sample_act.txt"), "w") as f:
        f.write("\f".join(pages))
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:
        sys.exit("reportlab not installed; wrote sample_act.txt only")
    c = canvas.Canvas(os.path.join(HERE, "sample_act.pdf"), pagesize=A4)
    for p in pages:
        y = 800
        for ln in p.split("\n"):
            c.setFont("Helvetica", 9); c.drawString(50, y, ln.replace("—", "-")); y -= 14
        c.showPage()
    c.save()
    print("wrote sample_act.txt and sample_act.pdf")
