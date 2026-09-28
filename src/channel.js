const CHANNEL_NAME = /^[a-zA-Z0-9_]{1,25}$/;
const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv']);

export function parseChannelInput(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  let name = value.replace(/^@/, '');
  if (/^https?:\/\//i.test(value) || /^(?:www\.|m\.)?twitch\.tv\//i.test(value)) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!TWITCH_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    try {
      name = decodeURIComponent(segments[0]);
    } catch {
      return null;
    }
  }

  return CHANNEL_NAME.test(name) ? name.toLowerCase() : null;
}
