"""Stereo call recording -> two mono WAVs. L channel = agent, R channel = customer."""
from __future__ import annotations

import subprocess
from pathlib import Path


def split_channels(mp3_path: Path, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    agent_wav = out_dir / "agent.wav"
    customer_wav = out_dir / "customer.wav"
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", str(mp3_path),
        "-filter_complex", "channelsplit=channel_layout=stereo[l][r]",
        "-map", "[l]", "-ar", "16000", "-ac", "1", str(agent_wav),
        "-map", "[r]", "-ar", "16000", "-ac", "1", str(customer_wav),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return agent_wav, customer_wav
