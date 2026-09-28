const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';

function decodeTag(value) {
  return value.replace(/\\([snr:\\])/g, (_, character) => ({
    s: ' ',
    n: '\n',
    r: '\r',
    ':': ';',
    '\\': '\\',
  })[character]);
}

export function parseIrcLine(line) {
  let rest = line;
  const tags = {};

  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ');
    if (space < 0) return null;
    for (const pair of rest.slice(1, space).split(';')) {
      const separator = pair.indexOf('=');
      if (separator >= 0) tags[pair.slice(0, separator)] = decodeTag(pair.slice(separator + 1));
      else tags[pair] = '';
    }
    rest = rest.slice(space + 1);
  }

  let prefix = '';
  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    if (space < 0) return null;
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  const separator = rest.indexOf(' :');
  const trailing = separator >= 0 ? rest.slice(separator + 2) : '';
  const words = (separator >= 0 ? rest.slice(0, separator) : rest).split(' ').filter(Boolean);
  if (words.length === 0) return null;

  return {
    tags,
    prefix,
    command: words[0],
    params: words.slice(1),
    trailing,
  };
}

export function getChatMessage(parsed, channel) {
  if (!parsed || parsed.command !== 'PRIVMSG' || parsed.params[0]?.toLowerCase() !== `#${channel}`) {
    return null;
  }

  const login = parsed.prefix.split('!')[0].toLowerCase();
  if (!login) return null;

  const message = parsed.trailing.replace(/^\u0001ACTION\s*/, '').replace(/\u0001$/, '').trim();
  if (!message) return null;

  return {
    key: parsed.tags['user-id'] || login,
    login,
    name: parsed.tags['display-name'] || login,
    id: parsed.tags.id || '',
    message,
  };
}

export function connectToChat(channel, handlers) {
  let socket;
  let stopped = false;
  let retryTimer;
  let retryCount = 0;
  let pending = '';

  function reconnect() {
    if (stopped) return;
    const baseDelay = Math.min(30_000, 1_000 * 2 ** Math.min(retryCount++, 5));
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    handlers.onStatus('reconnecting');
    retryTimer = setTimeout(open, delay);
  }

  function open() {
    if (stopped) return;
    pending = '';
    handlers.onStatus('connecting');
    socket = new WebSocket(IRC_URL);

    socket.addEventListener('open', () => {
      const guestName = `justinfan${Math.floor(Math.random() * 1_000_000_000)}`;
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
      socket.send(`NICK ${guestName}\r\n`);
      socket.send(`JOIN #${channel}\r\n`);
    });

    socket.addEventListener('message', (event) => {
      pending += String(event.data);
      const lines = pending.split('\r\n');
      pending = lines.pop() ?? '';

      for (const line of lines) {
        const parsed = parseIrcLine(line);
        if (!parsed) continue;

        if (parsed.command === 'PING') {
          socket.send(`PONG :${parsed.trailing || parsed.params[0] || 'tmi.twitch.tv'}\r\n`);
        } else if (parsed.command === '001') {
          retryCount = 0;
          handlers.onStatus('connected');
        } else if (parsed.command === 'PRIVMSG') {
          const message = getChatMessage(parsed, channel);
          if (message) handlers.onMessage(message);
        } else if (parsed.command === 'CLEARMSG' && parsed.params[0]?.toLowerCase() === `#${channel}`) {
          handlers.onDelete(parsed.tags['target-msg-id']);
        } else if (parsed.command === 'CLEARCHAT' && parsed.params[0]?.toLowerCase() === `#${channel}`) {
          handlers.onClear(parsed.trailing || null);
        } else if (parsed.command === 'RECONNECT') {
          socket.close();
        } else if (parsed.command === 'NOTICE' && parsed.tags['msg-id'] === 'msg_channel_suspended') {
          handlers.onStatus('unavailable');
        }
      }
    });

    socket.addEventListener('error', () => handlers.onStatus('reconnecting'));
    socket.addEventListener('close', reconnect);
  }

  open();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
