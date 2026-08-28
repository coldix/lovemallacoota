#!/usr/bin/env python3
"""Extract cover captions and page headings from local Mouth PDFs.

Reads data/archive-index.json, looks up mouth/YYYY/{filename}, and writes
cover + contents back onto each issue. PDFs stay local; only metadata is public.

Usage:
  python3 tools/extract-mouth-toc.py           # print, do not write
  python3 tools/extract-mouth-toc.py --write
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "data" / "archive-index.json"
MOUTH = ROOT / "mouth"

HEADER = re.compile(r"THE MALLACOOTA MOUTH|mallacoota mouth acknowledg", re.I)
SPONSOR = re.compile(r"front cover is proudly spon", re.I)
PHONE = re.compile(r"\b(?:0\d[\d ]{7,}|04\d{2}\s?\d{3}\s?\d{3}|1300\s?\d{2,4}\s?\d{3,4})\b")
PRICE = re.compile(r"\$\d")
DIARY_DAY = re.compile(
    r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b", re.I
)

SKIP_TITLE = re.compile(
    r"^(issue:?\s*\d+|editor:|mouth coordinator:|email:|telephone:|fax:|"
    r"\$2\.00|advertising rates|regular contributors|resources:|"
    r"we are a proud member|thank you!?$|the mouth$|"
    r"mallacoota p-?12 college$|produced by mallacoota|"
    r"classified advertisements?|when submitting your|"
    r"any advertisements that are created|"
    r"the community is reminded|"
    r"we acknowledge and pay respects|"
    r"instructions$|spot \d+ differences|"
    r"if you would like to|enquire now|call now|"
    r"this advertising space|could be yours|"
    r"no risk\.?$|no mess\.?$|no damage\.?$|guaranteed!?$|"
    r"prompt & professional|mobile service$|"
    r"what's coming up\?$|whats coming up\?$|"
    r"deliveries and pick up|bega every tuesday|"
    r"for prompt, courteous|'?we will deliver'|"
    r"i'?m here for you|robyn gibbs|chaplain$|"
    r"think spot:|easy - hard|crossword solution|"
    r"mouth$|^the$|^mallacoota$|"
    r"smiths$|pest control$|pandas$|"
    r"massage$|therapy$|easy hard|"
    r"tides taken at gabo island|"
    r"manufactured in the bega valley|"
    r"access after hours|n o appointment|"
    r"a friendly reminder|holiday birthday|"
    r"we would love to see you there|"
    r"thank you!? thank you|"
    r"about us$|we are open!?$|"
    r"q & a$|recommended \d+\+)$",
    re.I,
)

AD_HINT = re.compile(
    r"home handyman|lv electrical|massage therapy|smiths pest|"
    r"inlet plumbing|steel house framing|wall frames|"
    r"premium quality custom|book a free on-site|"
    r"qualified greenkeeper|qualified fitter|"
    r"servicing the genoa|call larz|call des tully|"
    r"phone john groom|call brodie|"
    r"rasmus|get a load of this|gravel$|"
    r"bricklaying concreting|crystal clear coota|"
    r"hair cut|for men &|winter weekly night|"
    r"lamb shanks|curry night|porterhouse|"
    r"pot & parma|fish and chips|seafood platter|"
    r"mower operator|racv patrolman|"
    r"my emergency doctor|free ser|vice$|"
    r"meeting room for hire|naturopath|"
    r"battbrothers|tree services|"
    r"josef.?s bookshop|gabo marine|salt home|"
    r"window and gutter cleaning|"
    r"j\.?m\.? garden maintenance|"
    r"wilderness coast|candles$|"
    r"mallacoota automotive|and towing|"
    r"delivery$",
    re.I,
)

STANDING = re.compile(
    r"^(editorial|mouth diary|public notices|madra news|"
    r"tide times|weekly weather forecast|"
    r"crossword(?: time)?|sudoku|church times|church services|"
    r"positions vacant|letter to the editor|"
    r"p-?12 (?:college )?newsletter|principal.?s report|"
    r"footmobiles|up-?streamings|sanctuary bulletin|"
    r"classifieds|what.?s on this week\??)$",
    re.I,
)


def collapse_ws(text: str) -> str:
    text = re.sub(r"-\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def undouble_outline(text: str) -> str:
    """Undo InDesign outline-font doubling: 'UUppssttrreeaam' -> 'Upstream'."""
    letters = [ch for ch in text if ch.isalpha()]
    if len(letters) < 8:
        return text
    pairs = sum(
        1
        for i in range(len(text) - 1)
        if text[i] == text[i + 1] and text[i].isalpha()
    )
    if pairs < 6 or pairs / (len(letters) / 2) < 0.7:
        return text
    out = []
    i = 0
    while i < len(text):
        if i + 1 < len(text) and text[i] == text[i + 1] and text[i].isalpha():
            out.append(text[i])
            i += 2
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def dedup_words(text: str) -> str:
    parts = []
    for word in text.split():
        if not parts or parts[-1].casefold() != word.casefold():
            parts.append(word)
    return " ".join(parts)


def clean_title(text: str) -> str:
    text = undouble_outline(collapse_ws(text))
    text = text.replace("&FAMILYFUNDAY", " & Family Fun Day")
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    return dedup_words(collapse_ws(text).strip(" -:|"))


def load_xml(path: Path) -> ET.Element:
    data = path.read_bytes().decode("utf-8", "replace")
    data = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", data)
    data = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", data)
    return ET.fromstring(data)


def parse_xml(pdf: Path, last: int | None = None) -> ET.Element:
    td = Path(tempfile.mkdtemp())
    try:
        out = td / "out.xml"
        cmd = ["pdftohtml", "-xml", "-i", "-q", str(pdf), str(out)]
        if last is not None:
            cmd[3:3] = ["-f", "1", "-l", str(last)]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return load_xml(out)
    finally:
        shutil.rmtree(td, ignore_errors=True)


def column_lines(page: ET.Element) -> tuple[list[str], list[str]]:
    width = float(page.get("width") or 892)
    mid = width * 0.48
    left, right = [], []
    for node in sorted(page.findall("text"), key=lambda t: (int(t.get("top") or 0), int(t.get("left") or 0))):
        text = "".join(node.itertext()).strip()
        if not text:
            continue
        bucket = right if int(node.get("left") or 0) >= mid else left
        bucket.append(text)
    return left, right


def sentences(text: str) -> list[str]:
    text = collapse_ws(text)
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def credit_from(text: str) -> str | None:
    patterns = [
        r"(?:supplied by|courtesy of)\s+([A-Z][A-Za-z .'-]{1,40}?)(?:\s+from|\s+for|\.|$)",
        r"thank(?:s| you) to\s+([A-Z][A-Za-z .'-]{1,40}?)(?:\s+for|\s+from|\.|$)",
        r"([A-Z][A-Za-z'-]+(?:\s[A-Z][A-Za-z'-]+)+)['’]s\s+(?:[\w-]+\s+){0,4}(?:stunning shot|dynamic photograph|photograph|photo|shot|image)",
    ]
    for index, pattern in enumerate(patterns):
        flags = 0 if index == 2 else re.I
        match = re.search(pattern, text, flags)
        if match:
            name = collapse_ws(match.group(1)).strip(" ,.")
            name = re.sub(r"\s+for$", "", name, flags=re.I)
            name = re.sub(r"^(?:year \d+\s+)?student\s+", "", name, flags=re.I)
            if " by " in name.lower():
                name = " ".join(name.split()[-2:])
            if 2 <= len(name) <= 40 and not SPONSOR.search(name):
                return name
    return None


def priya_cover_blurb(right: str) -> str | None:
    right = collapse_ws(right)
    match = re.search(
        r"(?:front cover|the front cover|thank you to .{1,50} for the front cover).+?(?=what'?s coming up\?|$)",
        right,
        re.I,
    )
    if not match:
        # Some issues lead with a one-line greeting then the cover sentence.
        match = re.search(
            r"((?:summer is here!?\s+)?thank you to .+?front cover.+?)(?=what'?s coming up\?|$)",
            right,
            re.I,
        )
    if not match:
        return None
    caption = collapse_ws(match.group(0))
    caption = re.split(r"\bwhat'?s coming up\b", caption, flags=re.I)[0]
    caption = re.sub(r"\bThe Mouth\b", " ", caption)
    caption = re.sub(
        r"The Mallacoota Mouth is a community (?:news(?:paper|letter)).+$",
        "",
        caption,
        flags=re.I,
    )
    caption = collapse_ws(caption).strip(" .")
    if SPONSOR.search(caption) or len(caption) < 12:
        return None
    return caption + ("." if caption[-1:] not in ".!?" else "")


def editorial_cover(text: str) -> str | None:
    kept = []
    parts = sentences(text)
    for index, sentence in enumerate(parts):
        if SPONSOR.search(sentence):
            continue
        if re.search(r"\bold Mouth covers\b", sentence, re.I):
            continue
        if re.search(r"\bcover\b", sentence, re.I):
            kept.append(sentence)
            nxt = parts[index + 1] if index + 1 < len(parts) else ""
            if nxt and re.search(r"photo|photograph|shot|supplied by|courtesy", nxt, re.I):
                kept.append(nxt)
    if not kept:
        return None
    caption = collapse_ws(" ".join(kept[:2]))
    caption = re.sub(r"^THE MALLACOOTA MOUTH[^A-Za-z]*.*?Editorial\s+", "", caption, flags=re.I)
    caption = re.sub(r"^Editorial\s+", "", caption, flags=re.I)
    return caption if len(caption) >= 20 else None


def page1_display(root: ET.Element) -> str | None:
    page = next((p for p in root.findall("page") if p.get("number") == "1"), None)
    if page is None:
        return None
    fonts = {node.get("id"): float(node.get("size") or 0) for node in page.findall("fontspec")}
    bits = []
    for node in page.findall("text"):
        size = fonts.get(node.get("font"), 0)
        text = "".join(node.itertext()).strip()
        if size >= 36 and text:
            bits.append((int(node.get("top") or 0), size, text))
    bits.sort()
    titles = []
    for _top, size, text in bits:
        title = clean_title(text)
        if keep_heading(title, size) and title.casefold() not in {"mallacoota", "mouth", "the"}:
            titles.append(title)
    if not titles:
        return None
    caption = collapse_ws(" ".join(titles[:3]))
    return caption if 4 <= len(caption) <= 90 else None


def extract_cover(root: ET.Element) -> dict | None:
    pages = {int(page.get("number")): page for page in root.findall("page")}
    page2 = pages.get(2)
    caption = None
    if page2 is not None:
        left, right = column_lines(page2)
        caption = priya_cover_blurb(" ".join(right))
        if not caption:
            caption = editorial_cover(" ".join(left)) or editorial_cover(" ".join(right))
    if not caption:
        display = page1_display(root)
        if display:
            caption = display
    if not caption:
        return None
    cover: dict = {"caption": caption}
    credit = credit_from(caption)
    if credit:
        cover["credit"] = credit
    return cover


ALLOW_SINGLE = {
    "choir",
    "genoa",
    "kakuro",
    "sudoku",
    "crossword",
    "reclink",
    "classifieds",
    "editorial",
}


def is_weak_name(title: str) -> bool:
    if " " in title or title.isupper():
        return False
    if title.casefold() in ALLOW_SINGLE or STANDING.search(title):
        return False
    return title[0].isupper() and title[1:].islower() and 2 <= len(title) <= 12


def is_ad(title: str) -> bool:
    if PHONE.search(title) or PRICE.search(title) or AD_HINT.search(title):
        return True
    if is_weak_name(title):
        return True
    if re.search(r"deadline|for sale|morning tea provided|10am|11am-2pm", title, re.I):
        return True
    if re.search(r"^\d{1,2}(?:st|nd|rd|th)?\s", title, re.I):
        return True
    if re.search(r"^\d{1,2}\s", title) and re.search(r"(am|pm|july|aug|sep)", title, re.I):
        return True
    return False


def keep_heading(title: str, size: float) -> bool:
    if len(title) < 4 or len(title) > 80:
        return False
    if HEADER.search(title) or SKIP_TITLE.search(title) or DIARY_DAY.search(title):
        return False
    if re.fullmatch(r"[\d.]+", title):
        return False
    if is_ad(title):
        return False
    if title[0].islower():
        return False
    if STANDING.search(title):
        return True
    if size >= 28:
        return True
    return False


def extract_contents(root: ET.Element) -> list[dict]:
    items: list[tuple[int, float, str]] = []
    for page in root.findall("page"):
        page_no = int(page.get("number"))
        fonts = {node.get("id"): float(node.get("size") or 0) for node in page.findall("fontspec")}
        bits = []
        for node in page.findall("text"):
            size = fonts.get(node.get("font"), 0)
            text = "".join(node.itertext()).strip()
            if not text or size < 22:
                continue
            bits.append((int(node.get("top") or 0), int(node.get("left") or 0), size, text))
        bits.sort()
        lines: list[list] = []
        for top, left, size, text in bits:
            if lines and abs(top - lines[-1][0]) <= 16 and abs(size - lines[-1][2]) <= 6:
                lines[-1][3].append(text)
                lines[-1][2] = max(lines[-1][2], size)
            else:
                lines.append([top, left, size, [text]])
        for _top, _left, size, parts in lines:
            title = clean_title(" ".join(parts))
            if keep_heading(title, size):
                items.append((page_no, size, title))

    merged: list[tuple[int, float, str]] = []
    for page_no, size, title in items:
        if (
            merged
            and merged[-1][0] == page_no
            and size >= 48
            and merged[-1][1] >= 48
            and len(merged[-1][2]) <= 24
            and len(title) <= 24
            and len(merged[-1][2]) + len(title) < 60
        ):
            merged[-1] = (page_no, max(merged[-1][1], size), f"{merged[-1][2]} {title}")
            continue
        if merged and merged[-1][0] == page_no and merged[-1][2].casefold() == title.casefold():
            continue
        merged.append((page_no, size, title))

    seen_standing: set[str] = set()
    contents = []
    for page_no, _size, title in merged:
        key = STANDING.sub(lambda m: m.group(0).casefold(), title) if STANDING.search(title) else None
        if key:
            if key in seen_standing:
                continue
            seen_standing.add(key)
        if title.casefold() == "newsletter":
            title = "P-12 College Newsletter"
            if "p-12 college newsletter" in seen_standing:
                continue
            seen_standing.add("p-12 college newsletter")
        if re.match(r"^(the )?front cover\b", title, re.I):
            continue
        contents.append({"page": page_no, "title": title})
        if len(contents) >= 20:
            break
    return contents


def process_pdf(pdf: Path) -> dict:
    try:
        root = parse_xml(pdf)
    except ET.ParseError as error:
        print(f"XML parse failed for {pdf.name}: {error}")
        return {"cover": None, "contents": []}
    return {"cover": extract_cover(root), "contents": extract_contents(root)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    catalogue = json.loads(CATALOGUE.read_text())
    missing = []
    for issue in catalogue["issues"]:
        year = issue["publicationDate"][:4]
        pdf = MOUTH / year / issue["filename"]
        if not pdf.exists():
            missing.append(str(pdf))
            continue
        extracted = process_pdf(pdf)
        issue["cover"] = extracted["cover"]
        issue["contents"] = extracted["contents"]
        cover = extracted["cover"]["caption"] if extracted["cover"] else "—"
        print(f"\n{issue['issueNumber']}  {issue['filename']}")
        print(f"  cover: {cover}")
        if extracted["cover"] and extracted["cover"].get("credit"):
            print(f"  credit: {extracted['cover']['credit']}")
        for entry in extracted["contents"]:
            print(f"  p{entry['page']:>2}  {entry['title']}")

    if missing:
        raise SystemExit("missing PDFs:\n" + "\n".join(missing))

    if args.write:
        catalogue["updatedAt"] = "2026-08-28"
        CATALOGUE.write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n")
        print(f"\nwrote {CATALOGUE}")
    else:
        print("\n(dry run — pass --write to update archive-index.json)")


if __name__ == "__main__":
    main()
