"""
Convert the Woosong international HUB timetable workbook ("[Eng] HUB_2025 ... .xlsx",
one tab per department) into data/courses.json for Course Rev AI.

Usage:
    pip install pandas openpyxl wordninja
    python convert_courses.py "HUB_2025.xlsx" --out data/courses.json

Every department formats its tab differently (different header names, repeated
header blocks, "Grade 2" divider rows, separate Day and Time columns, credits that
Excel turned into dates, continuation rows for extra meeting days ...). This script
normalizes all of that into one clean list of courses with sections.
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    import wordninja
except ImportError:
    wordninja = None

# ---------------------------------------------------------------- configuration

# Tabs that are not course lists
SKIP_SHEETS = {"Hours", "READ THIS!!!", "시트27", "시트28", "Grad"}

# Tab name -> (short code, English program name)
PROGRAMS = {
    "GCM": ("gcm", "Global Convergence Management"),
    "SIHOM": ("sihom", "Global Hotel Management"),
    "자유전공학부": ("free", "Free Major (자유전공학부)"),
    "AI": ("ai", "AI & Big Data"),
    "SIMA": ("sima", "Global Media and Communication Arts"),
    "KPOP": ("kpop", "K-POP & Entertainment"),
    "SIRA": ("sira", "Global Railway"),
    "SICA": ("sica", "Global Culinary Arts"),
    "SIRES": ("sires", "Global Food Service Entrepreneurship"),
    "GE (General Education)": ("ge", "General Education"),
    "JCFS": ("jcfs", "JCFS (Human Digital Interface)"),
    "SW교양": ("swge", "SW General Education"),
    "Sol-Connection": ("solc", "Sol Connection (English GE)"),
    "Korean Track": ("kor", "Korean Language Track"),
}

ACRONYMS = ["SIHOM", "SIRES", "SICA", "SIMA", "SIRA", "KPOP", "LLM", "AWS", "ICT", "ESG",
            "IoT", "SOL", "ERP", "PBL", "NLP", "CAD", "BIM", "AI", "IT", "UX", "UI",
            "SW", "HW", "HR", "VR", "XR", "DB", "GE", "TV", "PR"]
SMALL_WORDS = {"and", "of", "for", "in", "to", "the", "with", "on", "a", "an", "by", "at"}

# Names the automatic splitter cannot get right
NAME_OVERRIDES = {
    "IntrotoFAndBManagement": "Intro to F&B Management",
    "Foodandwineparing": "Food and Wine Pairing",
    "AandR 실습": "A&R Practice (A&R 실습)",
    "CapstoneDesigninCompanysProject1": "Capstone Design in Company's Project 1",
    "Python ll": "Python II",
}
TYPO_FIXES = [(r"\ban d\b", "and"), (r"Fooddservice", "Foodservice"), (r"Enterprenureship", "Entrepreneurship"),
              (r"Programing", "Programming"), (r"Mangement", "Management")]

TYPE_EN = {"기초": "Basic", "핵심": "Core", "중점": "Focus", "심화": "Advanced", "트랙": "Track",
           "전공": "Major", "전선": "Major Elective", "전필": "Major Required", "교양": "GE"}
MODE_EN = {"실험실습": "Practical (Lab)", "이론": "Theory", "이론+실습 병행": "Theory+Practical",
           "실습": "Practical"}
DAY_EN = {"월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat", "일": "Sun",
          "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun"}
DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# ---------------------------------------------------------------- helpers


def clean(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    s = str(v)
    if s.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", s).strip()


def has_hangul(s: str) -> bool:
    return bool(re.search(r"[가-힣]", s))


def split_glued(run: str) -> list[str]:
    protected, s = {}, run
    for i, ac in enumerate(sorted(ACRONYMS, key=len, reverse=True)):
        if ac in s:
            tok = f"zq{chr(97 + i)}zq"
            protected[tok] = ac
            s = s.replace(ac, f" {tok} ")
    words = []
    for chunk in s.split():
        if chunk in protected:
            words.append(protected[chunk])
        elif wordninja:
            words.extend(wordninja.split(chunk))
        else:
            words.append(chunk)
    return words


GLUED = re.compile(r"[a-z][A-Z]|[A-Z]{2,}[a-z]|[a-z]{14,}")
GLUED_SPACED = re.compile(r"[a-z][A-Z]|[A-Z]{3,}[a-z]")  # stricter when the name already has spaces


def fix_run(run: str, spaced: bool = False) -> str:
    if not (GLUED_SPACED if spaced else GLUED).search(run):
        return run
    words = split_glued(run)
    out = []
    for i, w in enumerate(words):
        if i > 0 and w.lower() in SMALL_WORDS:
            out.append(w.lower())
        elif w.islower():
            out.append(w.capitalize())
        else:
            out.append(w)
    return " ".join(out)


def nice_name(raw: str) -> str:
    raw = clean(raw)
    if raw in NAME_OVERRIDES:
        return NAME_OVERRIDES[raw]
    for pat, rep in TYPO_FIXES:
        raw = re.sub(pat, rep, raw)
    raw = re.sub(r"\s*\(\d\)$", "", raw)  # "...Management(1)" duplicate markers
    spaced = " " in raw
    name = re.sub(r"[A-Za-z]+", lambda m: fix_run(m.group(), spaced), raw)
    if name != raw:
        name = re.sub(r"([a-z])(\d)", r"\1 \2", name)
    name = re.sub(r"(\w)\(", r"\1 (", name)
    return re.sub(r"\s+", " ", name).strip()


def slug(text: str) -> str:
    s = re.sub(r"[^\w]+", "-", text.lower(), flags=re.UNICODE).strip("-")
    if not s:
        s = hashlib.md5(text.encode()).hexdigest()[:6]
    return s


def to_int(v):
    m = re.search(r"\d+", clean(v))
    return int(m.group()) if m else None


def parse_credit_hours(v):
    """'3/4' or an Excel date like 2025-03-04 (which was originally 3/4) -> (3, 4)"""
    s = clean(v)
    m = re.match(r"\d{4}-(\d{2})-(\d{2})", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r"(\d+)\s*/\s*(\d+)", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    return to_int(s), None


DAY_TOKEN = r"(?:Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:r|rs|rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?|[월화수목금토일])"
TIME_RANGE = r"(\d{1,2})(?::(\d{2}))?\s*[~\-–]\s*(\d{1,2})(?::(\d{2}))?"


def parse_times(text: str):
    m = re.search(TIME_RANGE, text)
    if not m:
        return None
    h1, m1, h2, m2 = m.groups()
    h1, h2 = int(h1), int(h2)
    if not (0 <= h1 <= 23 and 0 <= h2 <= 24) or h2 < h1:
        return None
    return f"{h1:02d}:{m1 or '00'}", f"{h2:02d}:{m2 or '00'}"


def expand_day_ranges(text: str) -> str:
    def rep(m):
        a, b = m.group(1), m.group(2)
        da = DAY_EN.get(a[:3].lower(), DAY_EN.get(a))
        db = DAY_EN.get(b[:3].lower(), DAY_EN.get(b))
        if da and db and DAY_ORDER.index(da) <= DAY_ORDER.index(db):
            return " " + " ".join(DAY_ORDER[DAY_ORDER.index(da): DAY_ORDER.index(db) + 1]) + " "
        return m.group(0)
    return re.sub(rf"({DAY_TOKEN})\.?\s*[~\-–]\s*({DAY_TOKEN})", rep, text, flags=re.I)


TOKEN = re.compile(rf"(?P<time>{TIME_RANGE})|(?P<day>{DAY_TOKEN})", re.I)


def parse_schedule(text: str) -> list[dict]:
    """Scan left to right: every time range applies to the days seen since the previous
    time range. Handles 'Mon, Wed(09:00-10:30)', 'Tue 09:00 ~ 10:30 Wed 09:00 ~ 10:30',
    'Thur. 09:00~12:00', '월화수목 7~12', '월~금 7~20', 'Tue (TUE)13:00 ~ 14:30' ..."""
    text = expand_day_ranges(clean(text))
    text = re.sub(r"\(?zoom[^)]*\)?", " ", text, flags=re.I)  # extra online sessions
    slots, days = [], []
    for m in TOKEN.finditer(text):
        if m.group("day"):
            t = m.group("day")
            d = DAY_EN.get(t[:3].lower(), DAY_EN.get(t))
            if d and d not in days:
                days.append(d)
        else:
            times = parse_times(m.group("time"))
            if times and days:
                for d in days:
                    slots.append({"day": d, "start": times[0], "end": times[1]})
                days = []
    return slots


# ---------------------------------------------------------------- header detection

def classify_header(cell: str, col: int):
    c = clean(cell).lower()
    if not c:
        return "department" if col == 0 else None
    if "make" in c and "up" in c or "보강" in c:
        return "makeup"
    if "credit number" in c or "학점/시수" in c:
        return "credit_hours"
    if "course" in c and "code" not in c:
        return "course"
    if "section" in c or "분반" in c:
        return "section"
    if "target" in c:
        return "target_year"
    if "type" in c or c == "core" or "이수구분" in c:
        return "type"
    if "mode" in c or "수업유형" in c:
        return "mode"
    if c in ("cr", "credit", "credits"):
        return "credits"
    if c in ("hr", "hrs", "hours"):
        return "hours"
    if "prof" in c or "담당교수" in c:
        return "professor"
    if "room" in c or "강의실" in c:
        return "room"
    if "schedule" in c:
        return "schedule"
    if c == "day" or "요일" in c:
        return "day"
    if c == "time" or c.startswith("시간"):
        return "time"
    if "remark" in c or "비고" in c:
        return "remark"
    if "code" in c:
        return "code"
    if "block" in c or "블록" in c:
        return "block"
    if c in ("department", "dept", "major", "`") or "개설학과" in c or "dept" in c:
        return "department"
    return None


def is_header_row(cells: list[str]) -> bool:
    low = [clean(c).lower() for c in cells]
    has_course = any(("course" in c and len(c) < 25) for c in low)
    others = sum(1 for c in low if any(k in c for k in ("section", "prof", "schedule", "target", "분반", "담당교수")))
    return has_course and others >= 1


# ---------------------------------------------------------------- main parsing

def parse_sheet(sheet: str, df: pd.DataFrame, code: str, program: str) -> list[dict]:
    rows, mapping, grade_ctx, last = [], None, None, None
    carry, note_title, note_text = {}, "", ""
    for _, r in df.iterrows():
        cells = r.tolist()
        if not any(clean(c) for c in cells):
            note_title = note_text = ""  # a blank row ends a sub block
            continue
        first = clean(cells[0]) if cells else ""
        gm = re.match(r"grade\s*(\d)", first, flags=re.I)
        if gm and not any(clean(c) for c in cells[1:]):
            grade_ctx = int(gm.group(1))
            continue
        if is_header_row(cells):
            mapping = {}
            for j, c in enumerate(cells):
                k = classify_header(c, j)
                if k and k not in mapping.values():
                    mapping[j] = k
            carry = {}
            continue
        if mapping is None:
            continue
        rec = {k: clean(cells[j]) for j, k in mapping.items() if j < len(cells)}
        if rec.get("department") and gm:  # e.g. 'Grade 2' row that also holds data
            rec["department"] = ""
        if gm:
            grade_ctx = int(gm.group(1))

        has_meeting = rec.get("schedule") or rec.get("day") or rec.get("time")
        course_txt = rec.get("course", "")
        if not rec.get("section") and not has_meeting and (course_txt.startswith(":") or (first and not course_txt)):
            # sub block heading such as "AI & Big Data Endicott Convergence Track : ONLY the students who ..."
            note_title = first
            note_text = " ".join(clean(c) for c in cells if clean(c)).replace(" :", ":")
            continue
        rec["note_title"], rec["note_text"] = note_title, note_text
        if rec.get("course") and not has_meeting and not re.search(r"\d", rec.get("section", "")):
            continue  # placeholder like "Optional" or "Track or Minor"
        if not rec.get("course"):
            if last and not rec.get("section") and has_meeting:
                # continuation row: another meeting time for the previous section
                text = rec.get("schedule") or f"{rec.get('day', '')} {rec.get('time', '')}"
                last["schedule_parts"].append(text)
                continue
            if last and rec.get("section") and (rec.get("professor") or has_meeting):
                rec["course"] = last["course_raw"]  # same course, new section
            else:
                continue
        # forward fill fields that are often blank on following rows of the same course
        for k in ("department", "target_year", "credits", "hours", "type", "mode", "code", "credit_hours"):
            if rec.get(k):
                carry[k] = rec[k]
            elif carry.get(k) and (last is None or rec["course"] == last["course_raw"] or k == "department"):
                rec[k] = carry[k]
        sched = rec.get("schedule") or f"{rec.get('day', '')} {rec.get('time', '')}".strip()
        last = {
            "course_raw": rec["course"],
            "rec": rec,
            "grade_ctx": grade_ctx,
            "schedule_parts": [sched] if sched else [],
        }
        rows.append(last)
    return rows


def build(rows_by_sheet) -> tuple[list[dict], int]:
    courses: dict[str, dict] = {}
    cancelled = 0
    for sheet, code, program, rows in rows_by_sheet:
        for row in rows:
            rec = row["rec"]
            remark = rec.get("remark", "")
            if "폐강" in remark or "cancel" in remark.lower():
                cancelled += 1
                continue
            name = nice_name(row["course_raw"])
            dept = rec.get("department", "")
            track = rec.get("note_title", "") if "track" in rec.get("note_title", "").lower() else ""
            if not track and sheet != "Korean Track" and ("트랙" in dept or "track" in dept.lower()):
                track = dept
            cid = f"{code}-{slug(name)}" + (f"-{slug(track)}" if track else "")
            if rec.get("note_text"):
                remark = "; ".join(x for x in (remark, rec["note_text"]) if x)
            if rec.get("credit_hours"):
                credits, hours = parse_credit_hours(rec["credit_hours"])
            else:
                credits, hours = to_int(rec.get("credits")), to_int(rec.get("hours"))
            ty = rec.get("target_year", "")
            years = [1, 2, 3, 4] if ty.lower() == "all" else [int(y) for y in re.findall(r"[1-4]", ty)]
            if not years and row["grade_ctx"]:
                years = [row["grade_ctx"]]
            type_raw = rec.get("type", "")
            type_en = "/".join(TYPE_EN.get(t.strip(), t.strip()) for t in type_raw.split("/")) if type_raw else ""
            mode_raw = rec.get("mode", "")
            c = courses.get(cid)
            if c is None:
                c = courses[cid] = {
                    "id": cid,
                    "name": name,
                    "name_original": row["course_raw"],
                    "program": program,
                    "program_code": code,
                    "department": rec.get("department", ""),
                    "target_years": years,
                    "credits": credits,
                    "hours": hours,
                    "type": type_en,
                    "mode": MODE_EN.get(mode_raw, mode_raw),
                    "track": track or None,
                    "course_code": re.sub(r"\s", "", rec.get("code", "")),
                    "taught_in_korean": has_hangul(row["course_raw"]) or None,
                    "professors": [],
                    "sections": [],
                }
            for y in years:
                if y not in c["target_years"]:
                    c["target_years"].append(y)
            prof = rec.get("professor", "")
            prof = "TBA" if prof in ("미정", "?", "") else prof
            if prof not in c["professors"] and prof != "TBA":
                c["professors"].append(prof)
            sched_text = " / ".join(p for p in row["schedule_parts"] if p)
            slots = []
            for p in row["schedule_parts"]:
                slots.extend(parse_schedule(p))
            sec = rec.get("section", "")
            sec = sec.zfill(3) if sec.isdigit() else (sec if sec not in ("?",) else "")
            if any(s["section"] == sec and s["professor"] == prof and s["schedule_text"] == sched_text
                   for s in c["sections"]):
                continue  # same section listed again (e.g. the K-POP tab repeats courses per cohort)
            c["sections"].append({
                "section": sec,
                "professor": prof,
                "room": "" if rec.get("room") == "?" else rec.get("room", ""),
                "schedule_text": sched_text,
                "slots": slots,
                "block": rec.get("block", ""),
                "remark": remark,
                "makeup": rec.get("makeup", ""),
            })
    out = []
    for c in courses.values():
        c["target_years"].sort()
        for k in ("taught_in_korean", "track"):
            if c[k] is None:
                del c[k]
        out.append(c)
    out.sort(key=lambda c: (c["program"], (c["target_years"] or [9])[0], c["name"]))
    return out, cancelled


def extract_notes(path: Path) -> str:
    try:
        df = pd.read_excel(path, sheet_name="READ THIS!!!", header=None, dtype=str)
    except Exception:
        return ""
    lines = []
    for _, r in df.iterrows():
        cells = [str(c).strip() for c in r.tolist() if str(c).strip() and str(c) != "nan"]
        if cells:
            lines.append("\n\n".join(cells))
    return "\n\n---\n\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--out", default="data/courses.json")
    args = ap.parse_args()
    path = Path(args.workbook)
    sheets = pd.read_excel(path, sheet_name=None, header=None, dtype=str)
    rows_by_sheet = []
    for name, df in sheets.items():
        key = name.strip()
        if key in SKIP_SHEETS:
            continue
        code, program = PROGRAMS.get(key, (slug(key), key))
        rows = parse_sheet(key, df, code, program)
        print(f"  {key:<24} {len(rows):>4} sections")
        rows_by_sheet.append((key, code, program, rows))
    courses, cancelled = build(rows_by_sheet)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(courses, ensure_ascii=False, indent=2), encoding="utf-8")
    nsec = sum(len(c["sections"]) for c in courses)
    print(f"Wrote {len(courses)} courses, {nsec} sections ({cancelled} cancelled sections skipped) to {out}")
    notes = extract_notes(path)
    if notes:
        np_ = out.parent / "registration_notes.md"
        np_.write_text(f"# Registration notes (from the 'READ THIS!!!' tab, {datetime.now():%Y-%m-%d})\n\n{notes}\n",
                       encoding="utf-8")
        print(f"Wrote {np_}")


if __name__ == "__main__":
    main()
