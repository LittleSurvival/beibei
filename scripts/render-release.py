"""Render the archive's photo card as MP4 and WebM."""

import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ALIGNMENT_SIZE = (480, 640)
PHOTO_SIZE = (1080, 1440)
VIDEO_SIZE = (1120, 1600)
DEFAULT_PHOTOS_PER_SECOND = 24
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
    # Convert output pixels to alignment coordinates, then to native source pixels.
    source_x, source_y = (size / basis for size, basis in zip(photo.size, ALIGNMENT_SIZE))
    output_x, output_y = (basis / size for basis, size in zip(ALIGNMENT_SIZE, PHOTO_SIZE))
    a, b, c, d, e, f = inverse
    native_inverse = (
        a * source_x * output_x, b * source_x * output_y, c * source_x,
        d * source_y * output_x, e * source_y * output_y, f * source_y,
    )
    return photo.transform(
        PHOTO_SIZE, Image.Transform.AFFINE, native_inverse, Image.Resampling.BICUBIC,
        fillcolor=PHOTO_BACKGROUND,
    )


def render(output, photos_per_second=DEFAULT_PHOTOS_PER_SECOND):
    if photos_per_second <= 0:
        raise ValueError("photos_per_second must be positive")
    days = json.loads((ROOT / "content/days.json").read_text(encoding="utf-8"))
    transforms = json.loads((ROOT / "content/stabilization.json").read_text(encoding="utf-8"))
    first, last = days[0]["day"], days[-1]["day"]
    stem = f"beibei-day{first}-day{last}"
    output.mkdir(parents=True, exist_ok=True)

    card_width, card_height = PHOTO_SIZE[0], VIDEO_SIZE[1] - 40
    mask = Image.new("L", (card_width, card_height))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, card_width - 1, card_height - 1), radius=38, fill=255)
    day_font = ImageFont.load_default(size=54)
    date_font = ImageFont.load_default(size=45)
    caption_y = (PHOTO_SIZE[1] + card_height) // 2
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{VIDEO_SIZE[0]}x{VIDEO_SIZE[1]}",
        "-framerate", str(photos_per_second), "-i", "-",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output / f"{stem}.mp4"),
        "-c:v", "libvpx-vp9", "-crf", "25", "-b:v", "0",
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
                draw.text((44, caption_y), f"Day {day}", font=day_font, fill="#d6ed9f",
                          stroke_width=2, anchor="lm")
                draw.text((card_width - 44, caption_y), row["date"], font=date_font,
                          fill="#b6b8ab", anchor="rm")
                frame = Image.new("RGB", VIDEO_SIZE, BACKGROUND)
                frame.paste(card, (20, 20), mask)
                stream.write(frame.tobytes())
        if encoder.wait():
            raise subprocess.CalledProcessError(encoder.returncode, command)

    for extension in ("mp4", "webm"):
        path = output / f"{stem}.{extension}"
        # Decode each output and check that every card appears once at the target size and rate.
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-err_detect", "explode", "-count_frames",
            "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames",
            "-of", "json", str(path),
        ], check=True, capture_output=True, text=True)
        expected = {
            "width": VIDEO_SIZE[0], "height": VIDEO_SIZE[1],
            "r_frame_rate": f"{photos_per_second}/1", "nb_read_frames": str(len(days)),
        }
        if probe.stderr or json.loads(probe.stdout)["streams"] != [expected]:
            raise RuntimeError(f"{path.name}: expected {expected}, got {probe.stdout}. {probe.stderr}")
    (output / "notes.md").write_text(f"紀錄被被day{first}~{last}的縮影\n", encoding="utf-8")
    (output / "metadata.json").write_text(json.dumps({
        "tag": f"day{first}-day{last}", "stem": stem,
        "title": f"被被日記day{first}~~day{last}",
    }, ensure_ascii=False), encoding="utf-8")
    print(f"Rendered {len(days)} photo cards from Day {first} through Day {last}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--photos-per-second", type=int, default=DEFAULT_PHOTOS_PER_SECOND,
                        help="Photo cards per second (default: 24); each photo occupies one frame.")
    args = parser.parse_args()
    if args.photos_per_second <= 0:
        parser.error("--photos-per-second must be positive")
    render(args.output.resolve(), args.photos_per_second)
