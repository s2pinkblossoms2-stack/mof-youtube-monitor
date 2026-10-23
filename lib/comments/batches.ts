// 댓글을 AI에 보낼 묶음으로 나눈다. 개수(count)와 글자 수(chars) 둘 다 넘지 않게 나눠, 긴 댓글이 많아도 한 요청이 커지지 않는다.
export function makeBatches<T extends { body: string }>(items: T[], maxCount: number, maxChars: number): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const item of items) {
    const len = item.body.length;
    if (current.length > 0 && (current.length >= maxCount || chars + len > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
