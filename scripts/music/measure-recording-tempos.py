"""Recheck the two recording-derived tempo estimates. Requires numpy and ffmpeg.

No recording is bundled with the app. Download into a temporary directory,
verify each pinned hash, then compare five-second pitch-class fingerprints at
all documented corresponding stanza positions. The average includes rubato
and breaths and is intentionally presented as an estimate.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request
import numpy as np

references = json.loads((Path(__file__).resolve().parents[2] / 'corpus/sources/tempo-references.json').read_text())
for selection, profile in references['psalm_profiles'].items():
    with tempfile.TemporaryDirectory(prefix='open1650-recording-') as directory:
        filename = Path(directory) / 'reference.mp3'
        urllib.request.urlretrieve(profile['url'], filename)
        assert hashlib.sha256(filename.read_bytes()).hexdigest() == profile['sha256']
        samples = np.frombuffer(subprocess.check_output([
            'ffmpeg', '-v', 'quiet', '-i', str(filename), '-ac', '1', '-ar', '8000', '-f', 'f32le', '-',
        ]), dtype=np.float32)
        frames = np.lib.stride_tricks.sliding_window_view(samples, 4096)[::800]
        spectrum = np.abs(np.fft.rfft(frames * np.hanning(4096), axis=1))
        frequency = np.fft.rfftfreq(4096, 1/8000)
        chroma = np.zeros((len(frames), 12))
        for midi in range(40, 90):
            hz = 440 * 2 ** ((midi - 69) / 12)
            mask = (frequency > hz * 2 ** (-0.4/12)) & (frequency < hz * 2 ** (0.4/12))
            chroma[:, midi % 12] += spectrum[:, mask].sum(axis=1)
        chroma = np.sqrt(chroma)
        chroma /= np.linalg.norm(chroma, axis=1)[:, None] + 1e-8
        starts = profile['matched_stanza_onsets_seconds']
        first = round(starts[0] * 10)
        template = chroma[first:first + 50]
        for time in starts[1:]:
            start = round(time * 10)
            similarity = (chroma[start:start + 50] * template).sum() / 50
            assert similarity > 0.92, f'{selection} at {time}: fingerprint mismatch {similarity}'
        bpm = round(profile['quarter_beats_per_stanza'] * 60 * (len(starts) - 1) / (starts[-1] - starts[0]))
        assert bpm == profile['bpm']
        print(f'{selection}: estimated {bpm} BPM; {len(starts)} matched stanza positions')
