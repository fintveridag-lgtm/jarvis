// Converts ElevenLabs "with-timestamps" character alignment into millisecond
// start/end cues per script section, by tracking each section's character
// offset in the exact concatenated text that was sent for synthesis.
export function computeCues(sections, alignment) {
  const starts = alignment?.character_start_times_seconds || [];
  const ends = alignment?.character_end_times_seconds || [];

  let offset = 0;
  const cues = [];

  for (const section of sections) {
    const charStart = offset;
    const charEnd = offset + section.text.length - 1;
    offset += section.text.length + 1; // +1 for the joining space

    if (!section.box) continue;
    if (!starts.length || !ends.length) continue;

    const startIdx = Math.max(0, Math.min(charStart, starts.length - 1));
    const endIdx = Math.max(0, Math.min(charEnd, ends.length - 1));

    cues.push({
      id: section.id,
      box: section.box,
      startMs: Math.round(starts[startIdx] * 1000),
      endMs: Math.round(ends[endIdx] * 1000),
    });
  }

  return cues;
}
