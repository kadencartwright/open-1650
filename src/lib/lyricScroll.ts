interface LyricScrollGeometry {
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
  viewportTop: number;
  targetTop: number;
  targetHeight: number;
  playerTop?: number;
}

/** Center the line in the reader's unobscured area, not the whole WebView. */
export function lyricScrollTop(geometry: LyricScrollGeometry): number {
  const {scrollTop, scrollHeight, viewportHeight, viewportTop, targetTop, targetHeight, playerTop} = geometry;
  const bottom = Math.min(viewportTop + viewportHeight, playerTop ?? Number.POSITIVE_INFINITY);
  const visibleHeight = Math.max(0, bottom - viewportTop);
  const inset = Math.min(16, visibleHeight / 4);
  const available = Math.max(0, visibleHeight - inset * 2);
  const lineTop = viewportTop + inset + Math.max(0, (available - targetHeight) / 2);
  return Math.max(0, Math.min(scrollHeight - viewportHeight, scrollTop + targetTop - lineTop));
}

/** Android WebView can ignore smooth scrollIntoView on a scrolling ancestor.
 * Move only the reader, with a cancellable animation that cannot scroll the
 * WebView itself or the fixed player/navigation out of position.
 */
export function followLyric(
  reader: HTMLElement,
  target: HTMLElement | null,
  player: HTMLElement | null,
  reducedMotion: boolean,
): () => void {
  const readerBox = reader.getBoundingClientRect();
  const targetBox = target?.getBoundingClientRect();
  const destination = targetBox ? lyricScrollTop({
    scrollTop: reader.scrollTop,
    scrollHeight: reader.scrollHeight,
    viewportHeight: reader.clientHeight,
    viewportTop: readerBox.top,
    targetTop: targetBox.top,
    targetHeight: targetBox.height,
    playerTop: player?.getBoundingClientRect().top,
  }) : 0;
  const start = reader.scrollTop;
  if (reducedMotion || Math.abs(destination - start) < 1) {
    reader.scrollTop = destination;
    return () => {};
  }
  let frame = 0;
  let startedAt: number | undefined;
  const animate = (now: number) => {
    startedAt ??= now;
    const progress = Math.min(1, (now - startedAt) / 260);
    const eased = 1 - (1 - progress) ** 3;
    reader.scrollTop = start + (destination - start) * eased;
    if (progress < 1) frame = window.requestAnimationFrame(animate);
  };
  frame = window.requestAnimationFrame(animate);
  return () => window.cancelAnimationFrame(frame);
}
