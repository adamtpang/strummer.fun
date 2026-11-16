export function fitStoryLines(
  text: string, measure: (value: string) => number, width: number, maxLines: number
) {
  if (width <= 0 || maxLines < 1) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (line && measure(`${line} ${word}`) <= width) {
      line += ` ${word}`;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const character of Array.from(word)) {
      if (line && measure(line + character) > width) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1];
    while (last && measure(`${last}...`) > width) last = Array.from(last).slice(0, -1).join('');
    visible[maxLines - 1] = measure('...') <= width ? `${last}...` : '';
  }
  return visible;
}
