export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionTitle(prompt: string) {
  const firstLine = prompt
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Untitled analysis";
  }

  const withoutProtocol = firstLine.replace(/^https?:\/\//, "");
  return withoutProtocol.length > 34
    ? `${withoutProtocol.slice(0, 31)}...`
    : withoutProtocol;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
