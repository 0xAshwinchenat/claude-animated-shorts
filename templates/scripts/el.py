r"""Minimal ElevenLabs API client. The key is read from the Windows user environment (HKCU\Environment) and never
printed. usage:
  python el.py voice <voice_id>                     -> voice info (or a shared-library lookup if not in My Voices)
  python el.py add <public_owner_id> <voice_id> <name>
  python el.py user                                 -> character quota
  python el.py tts <voice_id> <text_file> <out.mp3> <out_alignment.json> [model] [speed]
  python el.py sfx <out.mp3> <seconds|auto> <prompt_influence 0-1> <prompt text | @prompt_file> [loop]
                                                    -> a sound effect (POST /v1/sound-generation, eleven_text_to_sound_v2);
                                                       "loop" asks for a seamless loop. Prints the size and any cost header.
"""
import sys, json, subprocess, re, base64, urllib.request, urllib.error, urllib.parse

def key():
    r = subprocess.run(["reg", "query", r"HKCU\Environment", "/v", "ELEVENLABS_API_KEY"], capture_output=True, text=True)
    m = re.search(r"ELEVENLABS_API_KEY\s+REG_\w+\s+(\S+)", r.stdout)
    if not m: sys.exit("ELEVENLABS_API_KEY not found in HKCU\\Environment")
    return m.group(1)

def call(method, path, body=None):
    req = urllib.request.Request("https://api.elevenlabs.io" + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

cmd = sys.argv[1]
if cmd == "voice":
    vid = sys.argv[2]
    s, j = call("GET", f"/v1/voices/{vid}")
    if s == 200:
        print("IN MY VOICES:", json.dumps({k: j.get(k) for k in ("voice_id", "name", "category", "labels", "description")}, indent=1))
        print("settings:", j.get("settings"))
    else:
        print("not in My Voices:", s, j.get("detail"))
        s, j = call("GET", "/v1/shared-voices?" + urllib.parse.urlencode({"page_size": 100, "search": vid}))
        hits = [v for v in j.get("voices", []) if v.get("voice_id") == vid]
        print("shared lookup:", s, json.dumps([{k: v.get(k) for k in ("voice_id", "public_owner_id", "name", "category", "accent",
              "gender", "age", "use_case", "descriptive", "description")} for v in hits], indent=1))
elif cmd == "add":
    s, j = call("POST", f"/v1/voices/add/{sys.argv[2]}/{sys.argv[3]}", {"new_name": sys.argv[4]})
    print(s, j)
elif cmd == "user":
    s, j = call("GET", "/v1/user/subscription")
    print(s, {k: j.get(k) for k in ("tier", "character_count", "character_limit", "next_character_count_reset_unix", "voice_slots_used", "voice_limit")})
elif cmd == "tts":
    vid, tf, out, al = sys.argv[2:6]
    model = sys.argv[6] if len(sys.argv) > 6 else "eleven_multilingual_v2"
    asis = len(sys.argv) > 7 and sys.argv[7] == "asis"   # "asis": no voice_settings -> the voice's own stored settings
    speed = None if asis else (float(sys.argv[7]) if len(sys.argv) > 7 else 1.0)
    text = open(tf, encoding="utf-8").read().strip()
    body = {"text": text, "model_id": model}
    if not asis:
        body["voice_settings"] = {"stability": 0.5, "similarity_boost": 0.66, "style": 0.0, "use_speaker_boost": True, "speed": speed}
    s, j = call("POST", f"/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128", body)
    if s != 200: sys.exit(f"TTS failed {s}: {j.get('detail')}")
    open(out, "wb").write(base64.b64decode(j["audio_base64"]))
    json.dump({"alignment": j.get("alignment"), "normalized_alignment": j.get("normalized_alignment"), "model": model,
               "speed": speed, "voice_id": vid}, open(al, "w"), indent=0)
    print(f"wrote {out} ({len(text)} chars)")
elif cmd == "sfx":
    out, secs, infl, text = sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
    loop = len(sys.argv) > 6 and sys.argv[6] == "loop"
    if text.startswith("@"): text = open(text[1:], encoding="utf-8").read().strip()
    body = {"text": text, "prompt_influence": infl, "model_id": "eleven_text_to_sound_v2"}
    if secs != "auto": body["duration_seconds"] = float(secs)
    if loop: body["loop"] = True
    req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", method="POST",
                                 data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read(); hdr = {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        sys.exit(f"SFX failed {e.code}: {e.read()[:400].decode('utf-8', 'replace')}")
    open(out, "wb").write(data)
    cost = {k: v for k, v in hdr.items() if "cost" in k or "character" in k or k == "request-id"}
    print(json.dumps({"wrote": out, "bytes": len(data), "seconds": secs, "loop": loop, "headers": cost}))
