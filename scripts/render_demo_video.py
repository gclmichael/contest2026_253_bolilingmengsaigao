#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "docs" / "video"
SCENES_HTML = VIDEO_DIR / "demo-scenes.html"
MANIFEST = VIDEO_DIR / "narration_manifest.json"
NARRATION = VIDEO_DIR / "narration.json"
AUDIO = VIDEO_DIR / "FocusLoop_讲解.wav"
WORK_DIR = VIDEO_DIR / "rendered"
DEFAULT_OUTPUT = ROOT / "submission" / "博丽灵梦赛高-FocusLoop-contest2026_253_bolilingmengsaigao" / "02_FocusLoop_演示视频.mp4"


def run(command):
    subprocess.run([str(item) for item in command], cwd=ROOT, check=True)


def srt_time(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def write_srt(segments, durations, silence):
    cursor = 0.0
    lines = []
    cue_index = 1
    for segment_index, (segment, duration) in enumerate(zip(segments, durations), start=1):
        text = segment["text"]
        phrases = [part.strip() for part in re.split(r"(?<=[，。；！？])", text) if part.strip()]
        cues = []
        pending = ""
        for phrase in phrases:
            if pending and len(pending) + len(phrase) > 24:
                cues.append(pending)
                pending = ""
            pending += phrase
            while len(pending) > 28:
                cues.append(pending[:24])
                pending = pending[24:]
        if pending:
            cues.append(pending)

        total_chars = sum(len(cue) for cue in cues)
        segment_cursor = cursor
        for cue in cues:
            cue_duration = duration * len(cue) / total_chars
            cue_end = segment_cursor + cue_duration
            lines.extend([str(cue_index), f"{srt_time(segment_cursor)} --> {srt_time(cue_end)}", cue, ""])
            segment_cursor = cue_end
            cue_index += 1
        cursor += duration + (silence if segment_index < len(segments) else 0.0)
    path = VIDEO_DIR / "FocusLoop_demo.srt"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def render_scene_images(chrome, count):
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    base_uri = SCENES_HTML.resolve().as_uri()
    profile = WORK_DIR / "chrome-profile"
    profile.mkdir(exist_ok=True)
    for index in range(1, count + 1):
        output = WORK_DIR / f"scene_{index:02d}.png"
        run([
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=1920,1080",
            f"--user-data-dir={profile}",
            f"--screenshot={output}",
            f"{base_uri}?scene={index}",
        ])
        if index == 3:
            for step in range(1, 5):
                for tap in (0, 1):
                    step_output = WORK_DIR / f"scene_03_step_{step}_{tap}.png"
                    run([
                        chrome,
                        "--headless=new",
                        "--disable-gpu",
                        "--hide-scrollbars",
                        "--window-size=1920,1080",
                        f"--user-data-dir={profile}",
                        f"--screenshot={step_output}",
                        f"{base_uri}?scene=3&step={step}&tap={tap}",
                    ])


def render_scene_videos(ffmpeg, durations, silence):
    videos = []
    for index, duration in enumerate(durations, start=1):
        scene_duration = duration + (silence if index < len(durations) else 0.0)
        if index == 3:
            output = WORK_DIR / "scene_03.mp4"
            step_duration = scene_duration / 4
            click_duration = 0.7
            concat_lines = []
            tapped = None
            for step in range(1, 5):
                normal = (WORK_DIR / f"scene_03_step_{step}_0.png").as_posix()
                tapped = (WORK_DIR / f"scene_03_step_{step}_1.png").as_posix()
                concat_lines.extend([
                    f"file '{normal}'\n",
                    f"duration {step_duration - click_duration:.6f}\n",
                    f"file '{tapped}'\n",
                    f"duration {click_duration:.6f}\n",
                ])
            concat_lines.append(f"file '{tapped}'\n")
            interaction_list = WORK_DIR / "scene_03_interaction.txt"
            interaction_list.write_text("".join(concat_lines), encoding="utf-8")
            run([
                ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", interaction_list,
                "-t", f"{scene_duration:.3f}", "-vf", "fps=30,format=yuv420p", "-an",
                "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", output,
            ])
            videos.append(output)
            continue
        image = WORK_DIR / f"scene_{index:02d}.png"
        output = WORK_DIR / f"scene_{index:02d}.mp4"
        frames = max(1, round(scene_duration * 30))
        zoom = (
            "scale=2048:1152,"
            f"zoompan=z='min(zoom+0.00010,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=1920x1080:fps=30,format=yuv420p"
        )
        run([
            ffmpeg, "-y", "-loop", "1", "-i", image, "-t", f"{scene_duration:.3f}",
            "-vf", zoom, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-movflags", "+faststart", output,
        ])
        videos.append(output)
    return videos


def concat_and_mux(ffmpeg, videos, subtitles, output):
    concat_file = WORK_DIR / "concat.txt"
    concat_file.write_text("".join(f"file '{video.as_posix()}'\n" for video in videos), encoding="utf-8")
    silent_video = WORK_DIR / "FocusLoop_demo_silent.mp4"
    run([ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", concat_file, "-c", "copy", silent_video])

    subtitle_filter = (
        f"subtitles={subtitles.relative_to(ROOT).as_posix()}:"
        "force_style='FontName=Microsoft YaHei,FontSize=10,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&HAA000000,BorderStyle=1,Outline=1.2,Shadow=0,MarginV=34,Alignment=2'"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    run([
        ffmpeg, "-y", "-i", silent_video, "-i", AUDIO, "-vf", subtitle_filter,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", output,
    ])


def main():
    parser = argparse.ArgumentParser(description="Render the FocusLoop narrated demo video.")
    parser.add_argument("--chrome", default=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    parser.add_argument("--ffmpeg", default=r"C:\Program Files\Steinberg\Cubase 14\Externals\FFmpeg\5.1.1\ffmpeg.exe")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--reuse-scenes", action="store_true", help="Reuse existing scene PNG and MP4 files.")
    args = parser.parse_args()

    narration = json.loads(NARRATION.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    durations = [item["duration_seconds"] for item in manifest["segments"]]
    silence = 0.45

    subtitles = write_srt(narration["segments"], durations, silence)
    if args.reuse_scenes:
        videos = [WORK_DIR / f"scene_{index:02d}.mp4" for index in range(1, len(durations) + 1)]
    else:
        render_scene_images(Path(args.chrome), len(narration["segments"]))
        videos = render_scene_videos(Path(args.ffmpeg), durations, silence)
    concat_and_mux(Path(args.ffmpeg), videos, subtitles, args.output.resolve())
    print(args.output.resolve())


if __name__ == "__main__":
    main()
