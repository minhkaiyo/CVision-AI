"""Smoke tests for CV quality detection logic."""
import re, sys
sys.path.insert(0, ".")

WORDS_80 = " ".join(["word"] * 85)
WORDS_130 = " ".join(["word"] * 135)

def detect(parsed, text):
    issues, penalty = [], 0
    wc = len(text.split()) if text else 0
    if wc < 30:   issues.append("not_enough_text"); penalty += 60
    elif wc < 80: issues.append("very_short");      penalty += 35
    elif wc < 120:issues.append("short_content");   penalty += 15

    tl = text.lower() if text else ""
    kws = ["experience","education","skills","work","summary","profile","projects",
           "kinh nghiem","hoc van","ky nang"]
    found = sum(1 for k in kws if k in tl)
    if found == 0:   issues.append("no_cv_sections");  penalty += 40
    elif found < 2:  issues.append("few_cv_sections"); penalty += 20

    has_email = bool(re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text or ""))
    if not has_email and wc > 50: issues.append("no_email"); penalty += 10

    has_date = bool(re.search(r"\b(19|20)\d{2}\b", text or ""))
    if not has_date and wc > 100: issues.append("no_dates"); penalty += 10

    penalty = min(penalty, 90)
    return {"valid": penalty < 50, "wc": wc, "found": found, "issues": issues, "pct": penalty}

def run(name, fn):
    try:
        fn(); print(f"  PASS  {name}")
        return True
    except AssertionError as e:
        print(f"  FAIL  {name}: {e}")
        return False

def t_empty():
    r = detect({}, "")
    print(f"        penalty={r['pct']}% valid={r['valid']} issues={r['issues']}")
    assert r["pct"] >= 60
    assert not r["valid"]

def t_image():
    r = detect({}, "Page 1")
    print(f"        penalty={r['pct']}% valid={r['valid']}")
    assert r["pct"] >= 60

def t_random_long():
    # 200 words, no CV keywords → penalized for no sections
    noise = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod "
             "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam "
             "quis nostrud exercitation ullamco laboris nisi aliquip commodo consequat "
             "duis aute irure dolor reprehenderit voluptate velit esse cillum dolore "
             "fugiat nulla pariatur excepteur sint occaecat cupidatat proident deserunt "
             "mollit anim laborum pellentesque habitant morbi tristique senectus netus "
             "malesuada fames turpis egestas integer eget aliquet nibh praesent congue ") * 2
    r = detect({}, noise)
    print(f"        penalty={r['pct']}% valid={r['valid']} issues={r['issues']}")
    assert r["pct"] >= 40, f"Random long text: expected >= 40%, got {r['pct']}%"

def t_real_cv():
    text = (
        "Nguyen Van A | nguyenvana@email.com | 0912345678\n"
        "Software Engineer | Ho Chi Minh City, Vietnam\n\n"
        "WORK EXPERIENCE\n"
        "2020 - 2023 Senior Software Engineer at Google Vietnam\n"
        "- Led team of 8 engineers, increased system performance by 40%\n"
        "- Reduced infrastructure costs by 25% through optimization\n"
        "- Mentored 3 junior engineers improving velocity by 20%\n\n"
        "2018 - 2020 Software Engineer at Shopee Singapore\n"
        "- Built microservices serving 10 million daily users\n"
        "- Implemented CI/CD reducing deployment time from 2 hours to 15 minutes\n\n"
        "EDUCATION\n"
        "2014 - 2018 Bachelor of Computer Science Hanoi University GPA 3.8/4.0\n\n"
        "TECHNICAL SKILLS\n"
        "Python TypeScript Go Java React FastAPI Docker Kubernetes AWS PostgreSQL Redis\n\n"
        "PROJECTS\n"
        "- Real-time analytics dashboard serving 100k concurrent users\n"
        "- Open source library with 2000 GitHub stars\n"
    )
    parsed = {
        "workExperience": [{"title":"Senior Engineer"},{"title":"Engineer"}],
        "education": [{"degree":"Bachelor"}],
        "personalInfo": {"email":"nguyenvana@email.com","phone":"0912345678"},
        "additional": {"technicalSkills":["Python","React","SQL","Docker","AWS"]},
    }
    r = detect(parsed, text)
    print(f"        penalty={r['pct']}% valid={r['valid']} sections={r['found']} issues={r['issues']}")
    assert r["valid"], "Real CV must be valid"
    assert r["pct"] < 20, f"Real CV: expected < 20%, got {r['pct']}%"

def t_penalty_crushes_garbage():
    r = detect({}, "")
    mult = 1.0 - r["pct"] / 100.0
    final = int(60 * mult)
    print(f"        raw=60 * mult={mult:.2f} = final={final}")
    assert final < 30, f"Garbage should score < 30 after penalty, got {final}"

if __name__ == "__main__":
    tests = [("empty file", t_empty), ("image/scan", t_image), ("random long", t_random_long),
             ("real CV", t_real_cv), ("penalty math", t_penalty_crushes_garbage)]
    passed = sum(run(n, f) for n, f in tests)
    print(f"\n{passed}/{len(tests)} passed")
    sys.exit(0 if passed == len(tests) else 1)
