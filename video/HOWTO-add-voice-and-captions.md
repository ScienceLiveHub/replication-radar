# Adding voiceover + captions to the submission video (Ubuntu)

Files in this folder:
- `Openaire-hackathon.mp4` — the recorded screen capture (2:49, under the 3:00 limit).
- `voiceover.md` — the narration script, keyed to each shot.
- `captions.srt` — the same lines as subtitles, timed to the current 2:49 cut.

You want **your voice** + **on-screen captions** over the video. Two ways below — the first needs
almost no editing skill.

---

## Path A (recommended) — you record the voice, then it gets assembled

### 1. Install Audacity (voice recorder)
```bash
sudo apt install audacity
```

### 2. See the captions while you record
VLC auto-loads a subtitle file that has the **same name** as the video, so:
```bash
cp captions.srt Openaire-hackathon.srt
```
Open `Openaire-hackathon.mp4` in **VLC** — the captions now appear on screen. Now you can read along to them.

### 3. Record your narration
- Play the video in **VLC**.
- In **Audacity**, press **Record** and read `voiceover.md` aloud, timing each line to its caption.
- Pause ~1 second between lines; let the busy tool-output shots breathe (a couple of silent seconds is fine).
- Re-record any line by stopping and starting again — you can trim/rearrange in Audacity.
- Export: **File → Export → Export as WAV** → save it here as **`voiceover.wav`**.

### 4. Assemble (audio onto the video + captions in a BOTTOM BAR)
The captions go in a **black bar below the video**, so they never cover the terminal/web content.
`captions.ass` (already generated in this folder, resolution baked in) positions them there.
Once `voiceover.wav` is in this folder, either ask Claude to run it, or:
```bash
# ffmpeg (system): sudo apt install ffmpeg     # then:
ffmpeg -i Openaire-hackathon.mp4 -i voiceover.wav \
  -filter_complex "[0:v]scale=1920:-2,pad=1920:1312:0:0:color=black,subtitles=captions.ass[v]" \
  -map "[v]" -map 1:a:0 -c:v libx264 -crf 18 -preset veryfast -c:a aac -b:a 192k -shortest \
  Openaire-hackathon-final.mp4
```
- `scale=1920:-2` downsizes to 1080p-ish; `pad=1920:1312` adds a **170 px black strip at the bottom**.
- `subtitles=captions.ass` renders the captions **into that strip** (nothing on screen is covered).
- `-map 1:a:0` replaces the near-silent original audio with your voiceover.
- Output: **`Openaire-hackathon-final.mp4`** — that's the one to submit.

> If you re-time `captions.srt`, regenerate `captions.ass` first (the SRT alone renders huge and on top —
> it has no resolution info). Easiest: ask Claude to regenerate it, or re-run the SRT→ASS step.

---

## Path B — do it all in a GUI (Kdenlive)

```bash
sudo apt install kdenlive        # or: flatpak install flathub org.kde.kdenlive
```
1. **Project → Add Clip** → import `Openaire-hackathon.mp4`; drag it to the timeline.
2. **Audio:** either record with the built-in audio recorder while the clip plays, or import the WAV you made in Audacity and drop it on an audio track. Mute the original clip's audio if needed.
3. **Captions:** open the **Subtitles** tool → **Import** `captions.srt`. Drag any block that drifts so it sits on the right shot.
4. **Render** (Project → Render) → MP4 (H.264) → save the final file.

*(OpenShot — `sudo apt install openshot-qt` — is a simpler alternative if Kdenlive feels heavy.)*

---

## Tips
- **Sync:** recording your voice *while watching the video with captions showing* keeps voice + captions + visuals aligned — you just pause between lines.
- **Captions timing:** `captions.srt` is timed to the current 2:49 cut but only to ±2–3 s (frames were sampled every few seconds). If a block drifts, nudge it in Kdenlive, or adjust the timecodes in `captions.srt` and re-burn.
- **Length:** keep the final under **3:00** (currently 2:49 — adding audio doesn't change the length).
- **Don't overclaim:** the narration/captions deliberately scope the result to the *satellite era* — a partial replication — matching what's on screen.
