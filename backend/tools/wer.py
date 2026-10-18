"""Word/character error rate of transcripts against the synthetic script text.

Utterances are matched to script turns by time overlap (the renderer records each turn's start and
end in the manifest), so the score doesn't depend on the VAD cutting exactly at turn boundaries.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field

from rapidfuzz.distance import Levenshtein

_DEVANAGARI = re.compile(r"[ऀ-ॿ]")
_LATIN = re.compile(r"[A-Za-z]")


def normalize(text: str) -> list[str]:
    text = unicodedata.normalize("NFC", text).lower()
    # Drop punctuation (incl. Devanagari danda) but keep letters, marks (matras) and digits.
    cleaned = "".join(
        ch if unicodedata.category(ch)[0] in "LMN" or ch.isspace() else " " for ch in text
    )
    return cleaned.split()


def dominant_script(words: list[str]) -> str:
    deva = sum(1 for w in words if _DEVANAGARI.search(w))
    latin = sum(1 for w in words if _LATIN.search(w))
    if not deva and not latin:
        return "none"
    return "devanagari" if deva >= latin else "latin"


@dataclass
class TurnScore:
    lang: str
    ref: list[str]
    hyp: list[str]

    @property
    def word_edits(self) -> int:
        return Levenshtein.distance(self.ref, self.hyp)

    @property
    def char_edits(self) -> int:
        return Levenshtein.distance("".join(self.ref), "".join(self.hyp))

    @property
    def script_mismatch(self) -> bool:
        return bool(self.hyp) and dominant_script(self.ref) != dominant_script(self.hyp)


@dataclass
class Report:
    turns: list[TurnScore] = field(default_factory=list)
    unmatched_utterances: int = 0

    def by_lang(self) -> dict[str, dict[str, float]]:
        groups: dict[str, list[TurnScore]] = defaultdict(list)
        for t in self.turns:
            groups[t.lang].append(t)
        groups["all"] = list(self.turns)
        out = {}
        for lang, ts in groups.items():
            ref_words = sum(len(t.ref) for t in ts)
            ref_chars = sum(len("".join(t.ref)) for t in ts)
            out[lang] = {
                "turns": len(ts),
                "ref_words": ref_words,
                "wer": sum(t.word_edits for t in ts) / max(ref_words, 1),
                "cer": sum(t.char_edits for t in ts) / max(ref_chars, 1),
                "script_mismatch": sum(t.script_mismatch for t in ts) / max(len(ts), 1),
                "missed_turns": sum(1 for t in ts if not t.hyp) / max(len(ts), 1),
            }
        return out

    def extend(self, other: Report) -> None:
        self.turns.extend(other.turns)
        self.unmatched_utterances += other.unmatched_utterances


def score(manifest: dict, utterances: list[tuple[float, float, str]]) -> Report:
    """utterances: (t_start_s, t_end_s, text) in the same time base as the manifest."""
    turns = manifest["turns"]
    assigned: dict[int, list[tuple[float, str]]] = defaultdict(list)
    unmatched = 0
    for start, end, text in utterances:
        overlaps = [(min(end, t["end_s"]) - max(start, t["start_s"]), t["index"]) for t in turns]
        best, idx = max(overlaps)
        if best <= 0:
            unmatched += 1
            continue
        assigned[idx].append((start, text))

    report = Report(unmatched_utterances=unmatched)
    for t in turns:
        hyp_text = " ".join(text for _, text in sorted(assigned.get(t["index"], [])))
        report.turns.append(
            TurnScore(lang=t["lang"], ref=normalize(t["text"]), hyp=normalize(hyp_text))
        )
    return report


def format_table(rows: dict[str, dict[str, float]]) -> str:
    lines = [
        f"{'lang':10s} {'turns':>5s} {'words':>6s} {'WER':>7s} {'CER':>7s} {'script≠':>8s} {'missed':>7s}"
    ]
    for lang in sorted(rows, key=lambda k: (k == "all", k)):
        r = rows[lang]
        lines.append(
            f"{lang:10s} {r['turns']:5d} {r['ref_words']:6d} {r['wer']:7.1%} {r['cer']:7.1%} "
            f"{r['script_mismatch']:8.0%} {r['missed_turns']:7.0%}"
        )
    return "\n".join(lines)
