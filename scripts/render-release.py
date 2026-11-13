"""Render the archive's photo card as MP4 and WebM."""

import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PHOTO_SIZE = (480, 640)
VIDEO_SIZE = (500, 720)
PHOTOS_PER_SECOND = 6
VIDEO_FPS = 30
BACKGROUND = "#131512"
PHOTO_BACKGROUND = "#10130f"


def photo_frame(path, matrix):
    with Image.open(path) as source:
        photo = ImageOps.exif_transpose(source).convert("RGB")
    if matrix is None:
        return ImageOps.pad(photo, PHOTO_SIZE, Image.Resampling.BICUBIC, PHOTO_BACKGROUND)

    a, b, c, d, e, f = matrix
    det = a * e - b * d
    # Pillow takes the inverse of the source-to-canvas matrix used on the site.
    inverse = (e / det, -b / det, (b * f - e * c) / det,
               -d / det, a / det, (d * c - a * f) / det)
    return photo.resize(PHOTO_SIZE, Image.Resampling.BICUBIC).transform(
        PHOTO_SIZE, Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC,
        fillcolor=PHOTO_BACKGROUND,
    )


def render(output):
    days = json.loads((ROOT / "content/days.json").read_text(encoding="utf-8"))
    transforms = json.loads((ROOT / "content/stabilization.json").read_text(encoding="utf-8"))
    first, last = days[0]["day"], days[-1]["day"]
    stem = f"beibei-day{first}-day{last}"
    output.mkdir(parents=True, exist_ok=True)

    mask = Image.new("L", (480, 700))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 479, 699), radius=18, fill=255)
    day_font = ImageFont.load_default(size=25)
    date_font = ImageFont.load_default(size=21)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{VIDEO_SIZE[0]}x{VIDEO_SIZE[1]}",
        "-framerate", str(PHOTOS_PER_SECOND), "-i", "-",
        "-r", str(VIDEO_FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output / f"{stem}.mp4"),
        "-r", str(VIDEO_FPS), "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
        "-deadline", "good", "-cpu-used", "4", "-row-mt", "1",
        "-pix_fmt", "yuv420p", str(output / f"{stem}.webm"),
    ]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
        with encoder.stdin as stream:
            for row in days:
                day = row["day"]
                path = ROOT / "fangyi-timelapse/photos" / row["image"]
                photo = photo_frame(path, transforms.get(str(day)))
                card = Image.new("RGB", mask.size, "#20271e")
                card.paste(photo, (0, 0))
                draw = ImageDraw.Draw(card)
                draw.text((20, 670), f"Day {day}", font=day_font, fill="#d6ed9f",
                          stroke_width=1, anchor="lm")
                draw.text((460, 670), row["date"], font=date_font, fill="#b6b8ab", anchor="rm")
                frame = Image.new("RGB", VIDEO_SIZE, BACKGROUND)
                frame.paste(card, (10, 10), mask)
                stream.write(frame.tobytes())
        if encoder.wait():
            raise subprocess.CalledProcessError(encoder.returncode, command)

    for extension in ("mp4", "webm"):
        path = output / f"{stem}.{extension}"
        # Decode each output and check that every card has its full display time.
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-err_detect", "explode", "-count_frames",
            "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames",
            "-of", "csv=p=0", str(path),
        ], check=True, capture_output=True, text=True)
        expected = len(days) * VIDEO_FPS // PHOTOS_PER_SECOND
        if probe.stderr or probe.stdout.strip() != str(expected):
            raise RuntimeError(f"{path.name}: expected {expected} frames, got {probe.stdout.strip()}. {probe.stderr}")
    (output / "notes.md").write_text(f"紀錄被被day{first}~{last}的縮影\n", encoding="utf-8")
    (output / "metadata.json").write_text(json.dumps({
        "tag": f"day{first}-day{last}", "stem": stem,
        "title": f"被被日記day{first}~~day{last}",
    }, ensure_ascii=False), encoding="utf-8")
    print(f"Rendered {len(days)} photo cards from Day {first} through Day {last}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    render(parser.parse_args().output.resolve())
