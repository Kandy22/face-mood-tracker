#!/usr/bin/env python3
"""Build src/data/tracks.json from the scraped YouTube playlist CSV.

- Dedupes by video id (the scrape captured the playlist twice).
- Cleans "Artist - Title (Official Video)" noise out of titles.
- Bakes in a per-video mood classification (the app's 7 moods) and a
  music/clip type so movie trailers & interview clips stay out of the
  mood-driven music queues.

Run:  python3 scripts/build_tracks.py ../youtube-mim-217-tracks.csv
"""
import csv, json, re, sys, os

# videoId -> (mood, type). Moods: Happy Sad Angry Calm Excited Anxious Neutral
CLASSIFICATION = {
    "UbxUSsFXYo4": ("Happy", "music"),   "eVTXPUF4Oz4": ("Sad", "music"),
    "kXYiU_JCYtU": ("Sad", "music"),     "ZpUYjpKg9KY": ("Angry", "music"),
    "qEcic7j4bMc": ("Angry", "music"),   "djeOkEg5pmQ": ("Excited", "music"),
    "jRGrNDV2mKc": ("Angry", "music"),   "VAWjsVoDpm0": ("Angry", "music"),
    "4fndeDfaWCg": ("Sad", "music"),     "Ug88HO2mg44": ("Sad", "music"),
    "h_m-BjrxmgI": ("Calm", "music"),    "m6pW_q1PvH0": ("Happy", "music"),
    "-oqAU5VxFWs": ("Happy", "music"),   "1D5PtyrewSs": ("Sad", "music"),
    "tvtJPs8IDgU": ("Happy", "music"),   "Yn8CZyqfex8": ("Happy", "music"),
    "Bm5iA4Zupek": ("Sad", "music"),     "PsO6ZnUZI0g": ("Excited", "music"),
    "6CHs4x2uqcQ": ("Calm", "music"),    "MYF7H_fpc-g": ("Excited", "music"),
    "HAfFfqiYLp0": ("Excited", "music"), "sOnqjkJTMaA": ("Excited", "music"),
    "oRdxUFDoQe0": ("Excited", "music"), "ho7796-au8U": ("Happy", "music"),
    "Bjb5vhazFio": ("Calm", "music"),    "XleOkGsYgO8": ("Anxious", "music"),
    "gPDcwjJ8pLg": ("Excited", "music"), "A6APxbBYnoo": ("Angry", "music"),
    "ysSxxIqKNN0": ("Anxious", "music"), "MrHxhQPOO2c": ("Happy", "music"),
    "U7dBMYUyRAQ": ("Happy", "music"),   "b-F70bAzbTM": ("Neutral", "music"),
    "7Znh0OM9jiA": ("Neutral", "music"), "Jne9t8sHpUc": ("Sad", "music"),
    "2dH289KxkGw": ("Sad", "music"),     "fV4DiAyExN0": ("Sad", "music"),
    "araU0fZj6oQ": ("Sad", "music"),     "mVQpfoqsY8Q": ("Sad", "music"),
    "vsQzw_Ax8Cw": ("Happy", "music"),   "22zB6Soc2Gk": ("Sad", "music"),
    "8xvhutWc67k": ("Excited", "music"), "K9S5EZgIJck": ("Calm", "music"),
    "MUuNDb-nm5M": ("Sad", "music"),     "YFood_bTOX4": ("Sad", "music"),
    "koJlIGDImiU": ("Calm", "music"),    "1wAGacczNho": ("Calm", "music"),
    "iYhURhmsKTI": ("Calm", "music"),    "na47wMFfQCo": ("Calm", "music"),
    "1vhFnTjia_I": ("Happy", "music"),   "1w7OgIMMRc4": ("Excited", "music"),
    "xyzlrA1IYcY": ("Angry", "music"),   "h4UqMyldS7Q": ("Calm", "music"),
    "SYnJNfnJJQU": ("Excited", "music"), "I7eZ4mAfbp8": ("Sad", "music"),
    "7hx4gdlfamo": ("Calm", "music"),    "x7E4Q4e4S2c": ("Neutral", "clip"),
    "bxUfg3uCBbg": ("Happy", "music"),   "MK6TXMsvgQg": ("Happy", "music"),
    "YGAeI5KODLA": ("Happy", "music"),   "lIF5EEneWEU": ("Calm", "music"),
    "8KHwuOtcALQ": ("Angry", "music"),   "mrF4nF8VUb4": ("Calm", "music"),
    "QRuCPS_-_IA": ("Happy", "music"),   "3cQNkIrg-Tk": ("Neutral", "music"),
    "sh7BZf7D5Bw": ("Excited", "music"), "uObstcmJeLw": ("Calm", "music"),
    "ABfQuZqq8wg": ("Happy", "music"),   "3GwjfUFyY6M": ("Happy", "music"),
    "kA9uaBqvRtA": ("Excited", "music"), "FTQbiNvZqaY": ("Calm", "music"),
    "09839DpTctU": ("Calm", "music"),    "CICIOJqEb5c": ("Sad", "music"),
    "YxvBPH4sArQ": ("Excited", "music"), "e6GB04zeDeQ": ("Excited", "music"),
    "x8no2UG-oZ0": ("Excited", "music"), "fvzs2ozG-mc": ("Happy", "music"),
    "6dYWe1c3OyU": ("Excited", "music"), "rBrd_3VMC3c": ("Calm", "music"),
    "UMGf94MNUuY": ("Neutral", "clip"),  "YO7M0Hx_1D8": ("Happy", "music"),
    "oGpFcHTxjZs": ("Sad", "music"),     "Xxh9Da_EJB4": ("Calm", "music"),
    "P_f1r58NB-k": ("Happy", "music"),   "o0hbEGng7U0": ("Sad", "music"),
    "QC-eDtV5O0Q": ("Sad", "music"),     "qae25976UgA": ("Happy", "music"),
    "ok__l1Acuwg": ("Calm", "music"),    "EVcpKjXYa5c": ("Happy", "music"),
    "FMjzKKcz_ew": ("Happy", "music"),   "JzYf6qskdfA": ("Happy", "music"),
    "mdt0SOqPJcg": ("Happy", "music"),   "ZbZSe6N_BXs": ("Happy", "music"),
    "8v8-RSyuUeE": ("Happy", "music"),   "WM7-PYtXtJM": ("Sad", "music"),
    "V1bFr2SWP1I": ("Calm", "music"),    "s3wNuru4U0I": ("Calm", "music"),
    "69RdQFDuYPI": ("Calm", "music"),    "79fzeNUqQbQ": ("Excited", "music"),
    "PIb6AZdTr-A": ("Happy", "music"),   "aGCdLKXNF3w": ("Calm", "music"),
    "Qjzjhl-QztE": ("Sad", "music"),     "BHnJp0oyOxs": ("Sad", "music"),
    "8SbUC-UaAxE": ("Sad", "music"),     "o1tj2zJ2Wvg": ("Angry", "music"),
    "rY0WxgSXdEE": ("Excited", "music"), "CD-E-LDc384": ("Anxious", "music"),
    "F5lLn4B8nQw": ("Excited", "clip"),  "hmf4gHBa-Zw": ("Happy", "clip"),
    "sWofeRh_53g": ("Excited", "clip"),  "F_VIM03DXWI": ("Excited", "clip"),
    "5uMDUHdN24o": ("Excited", "clip"),  "PUZIgc5AeHg": ("Excited", "clip"),
    "olxto6CgFPo": ("Excited", "clip"),  "QhJ-pEyIYWU": ("Excited", "clip"),
    "s7W-zEsFjMM": ("Sad", "clip"),      "R_W7PC6NnN4": ("Anxious", "clip"),
    "F7_aagPOpUU": ("Anxious", "clip"),  "8QAaRrqtbaM": ("Anxious", "clip"),
    "Uu7qV57UKSo": ("Happy", "clip"),    "H3g5QQynaJk": ("Happy", "clip"),
    "iycrf7AfjOc": ("Anxious", "clip"),  "vHbGwQ664fA": ("Anxious", "clip"),
    "Gd9OhYroLN0": ("Anxious", "music"), "WNcsUNKlAKw": ("Calm", "music"),
    "k4V3Mo61fJM": ("Sad", "music"),     "DphfdE5i0Oo": ("Excited", "music"),
    "PffesLl6-xM": ("Calm", "music"),    "Ajp0Uaw4rqo": ("Calm", "music"),
    "0Rw-UsRPNqc": ("Calm", "music"),    "F_HoMkkRHv8": ("Excited", "music"),
    "DL7-CKirWZE": ("Happy", "music"),   "HEMjF2n3-SQ": ("Excited", "music"),
    "T9NLgyEFzOo": ("Happy", "music"),   "XWN65nAkk20": ("Happy", "music"),
    "AQXVHITd1N4": ("Happy", "clip"),    "rog8ou-ZepE": ("Excited", "music"),
    "kM5ywtImaSs": ("Excited", "music"), "Nvq7zPB4gcY": ("Happy", "clip"),
    "hfqD5aW0X5U": ("Anxious", "clip"),  "447P7uz3FyE": ("Anxious", "clip"),
    "RM6nwZBBbAo": ("Neutral", "clip"),  "fbSIOmEWtTs": ("Neutral", "clip"),
    "KPhqU--Mq1A": ("Excited", "music"), "sJzmaNfAkXA": ("Neutral", "clip"),
}

NOISE = re.compile(
    r"\s*[\(\[][^)\]]*(official|video|audio|hd|hq|4k|remaster|lyric|live|"
    r"upgrade|version|music)[^)\]]*[\)\]]\s*", re.I)


def clean_title(raw: str, channel: str = "") -> tuple[str, str | None]:
    """Return (title, artist_guess) from a scraped YouTube title.

    YouTube music titles are usually "Artist - Title" but sometimes
    "Title - Artist". Disambiguate by matching each side against the
    channel name (official artist channels match their own name);
    fall back to assuming the left side is the artist.
    """
    t = NOISE.sub(" ", raw).strip(" -–|•\t ")
    ch = channel.strip().lower()
    for sep in (" - ", " – ", ": "):
        if sep in t:
            left, right = (s.strip() for s in t.split(sep, 1))
            ll, rl = left.lower(), right.lower()
            if ch and (ch in ll or ll in ch):
                return right, left          # left is the artist
            if ch and (ch in rl or rl in ch):
                return left, right          # right is the artist
            return right, left              # default: Artist - Title
    return t.strip(), None


def main(csv_path: str, out_path: str) -> None:
    rows = list(csv.reader(open(csv_path)))[1:]
    seen: set[str] = set()
    tracks = []
    for r in rows:
        if len(r) < 7:
            continue
        m = re.search(r"v=([A-Za-z0-9_-]{11})", r[1])
        if not m:
            continue
        vid = m.group(1)
        if vid in seen:
            continue
        seen.add(vid)
        mood, kind = CLASSIFICATION.get(vid, ("Neutral", "music"))
        channel = r[5].strip()
        title, artist = clean_title(r[4], channel)
        tracks.append({
            "videoId": vid,
            "title": title,
            "artist": artist or channel,
            "mood": mood,
            "type": kind,
            "duration": r[3].strip(),
            "views": r[7].strip() if len(r) > 7 else "",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            "youtubeUrl": f"https://www.youtube.com/watch?v={vid}",
        })

    with open(out_path, "w") as f:
        json.dump(tracks, f, indent=2)

    from collections import Counter
    music = [t for t in tracks if t["type"] == "music"]
    print(f"Wrote {len(tracks)} tracks ({len(music)} music, "
          f"{len(tracks) - len(music)} clips) -> {out_path}")
    print("Music per mood:", dict(Counter(t["mood"] for t in music)))


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    csv_in = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        here, "..", "..", "youtube-mim-217-tracks.csv")
    out = os.path.join(here, "..", "src", "data", "tracks.json")
    main(csv_in, out)
