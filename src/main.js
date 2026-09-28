import { connectToChat } from './irc.js';
import { parseChannelInput } from './channel.js';

function channelFromPath(pathname) {
  const path = pathname.replace(/^\/|\/$/g, '');
  if (!path || path.includes('/')) return null;
  try {
    return parseChannelInput(decodeURIComponent(path));
  } catch {
    return null;
  }
}

let channel = channelFromPath(location.pathname);
if (!channel) {
  let answer = prompt('Введите ссылку на Twitch-канал или никнейм стримера:');
  while (answer !== null) {
    channel = parseChannelInput(answer);
    if (channel) {
      history.replaceState(null, '', `/${channel}${location.search}${location.hash}`);
      break;
    }
    answer = prompt('Не удалось распознать канал. Введите ссылку Twitch или никнейм стримера:');
  }
}

const scene = document.querySelector('#scene');
const status = document.querySelector('#connection-status');
const query = new URLSearchParams(location.search);
const showDebug = query.has('debug');
const previewMode = location.hostname === 'localhost' && query.has('preview');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const IDLE_MS = 5 * 60 * 1000;
const BUBBLE_MS = 6 * 1000;
const MESSAGE_LENGTH = 100;
const WALKER_WIDTH = 88;
const COLLISION_DISTANCE = 42;
const COLLISION_FALL_CHANCE = 0.01;
const COLORS = [
  ['#89d9ce', '#eab7ab', '#392c42'],
  ['#f1a9c4', '#b98269', '#36243b'],
  ['#f0c765', '#f4c9a8', '#4c302d'],
  ['#a5b7ee', '#d49b78', '#332f46'],
  ['#b9dc9e', '#8f5d4d', '#241d2d'],
  ['#f0a887', '#e5b596', '#59443d'],
];

const people = new Map();
let nextWalkerIndex = 0;
let activeContacts = new Set();
let animationFrame = 0;
let lastFrame = 0;
let disconnect;

document.title = channel ? `${channel} · Twitch chat overlay` : 'Twitch chat overlay';
status.hidden = !showDebug && Boolean(channel);

function hashName(name) {
  let hash = 0;
  for (const character of name) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  return Math.abs(hash);
}

function shorten(text) {
  const characters = Array.from(text);
  return characters.length > MESSAGE_LENGTH
    ? `${characters.slice(0, MESSAGE_LENGTH - 1).join('').trimEnd()}…`
    : text;
}

function setBaseline(person) {
  person.element.style.bottom = '12px';
}

function createPerson(message) {
  const element = document.createElement('article');
  element.className = 'walker';
  element.setAttribute('aria-label', `Участник чата ${message.name}`);
  element.innerHTML = `
    <div class="bubble" hidden><span class="bubble-text"></span></div>
    <div class="figure" aria-hidden="true">
      <span class="hair"></span>
      <span class="head"><span class="eyes"></span><span class="blush"></span></span>
      <span class="arm arm-left"></span><span class="arm arm-right"></span>
      <span class="shirt"></span>
      <span class="leg leg-left"></span><span class="leg leg-right"></span>
    </div>
    <div class="username"></div>
  `;

  const palette = COLORS[hashName(message.login) % COLORS.length];
  element.style.setProperty('--shirt-color', palette[0]);
  element.style.setProperty('--skin-color', palette[1]);
  element.style.setProperty('--hair-color', palette[2]);
  element.querySelector('.username').textContent = message.name;
  scene.append(element);

  const positionIndex = nextWalkerIndex++;
  const person = {
    key: message.key,
    login: message.login,
    element,
    bubble: element.querySelector('.bubble'),
    bubbleText: element.querySelector('.bubble-text'),
    bubbleId: '',
    bubbleWidth: 0,
    bubbleTimer: 0,
    danceTimer: 0,
    lastMessageAt: Date.now(),
    x: ((positionIndex * 0.61803398875 + 0.12) % 1) * Math.max(0, window.innerWidth - WALKER_WIDTH),
    speed: 26 + (hashName(message.login) % 22),
    direction: hashName(message.login) % 2 ? 1 : -1,
    isFallen: false,
  };

  setBaseline(person);
  element.dataset.facing = person.direction < 0 ? 'left' : 'right';
  element.style.transform = `translate3d(${person.x}px, 0, 0)`;
  people.set(person.key, person);
  startAnimation();
  return person;
}

function hideBubble(person) {
  clearTimeout(person.bubbleTimer);
  person.bubble.hidden = true;
  person.element.classList.remove('is-speaking');
  person.bubbleId = '';
}

function removePerson(person) {
  hideBubble(person);
  clearTimeout(person.danceTimer);
  person.element.remove();
  people.delete(person.key);
}

function positionBubble(person) {
  if (person.bubble.hidden) return;
  const centered = (WALKER_WIDTH - person.bubbleWidth) / 2;
  const left = Math.max(8 - person.x, Math.min(centered, window.innerWidth - 8 - person.x - person.bubbleWidth));
  person.bubble.style.left = `${left}px`;
  person.bubble.style.setProperty('--bubble-arrow-x', `${44 - left}px`);
}

function showMessage(message) {
  const person = people.get(message.key) ?? createPerson(message);
  if (person.isFallen) {
    person.isFallen = false;
    person.element.classList.remove('is-fallen');
    startAnimation();
  }
  person.lastMessageAt = Date.now();
  if (message.message.trim().toLocaleLowerCase('ru-RU') === '!танец') {
    hideBubble(person);
    person.element.classList.remove('is-dancing');
    void person.element.offsetWidth;
    person.element.classList.add('is-dancing');
    clearTimeout(person.danceTimer);
    person.danceTimer = setTimeout(() => person.element.classList.remove('is-dancing'), 10_000);
    return;
  }

  person.bubbleId = message.id;
  person.bubbleText.textContent = shorten(message.message);
  person.bubble.hidden = false;
  person.element.classList.add('is-speaking');
  person.bubbleWidth = person.bubble.offsetWidth;
  positionBubble(person);
  clearTimeout(person.bubbleTimer);
  person.bubbleTimer = setTimeout(() => hideBubble(person), BUBBLE_MS);
}

function pairKey(first, second) {
  return JSON.stringify([first.key, second.key].sort());
}

function isMovingToward(person, other) {
  return Math.sign(other.x - person.x) === person.direction;
}

function choosePusher(first, second) {
  const firstIsClosing = isMovingToward(first, second);
  const secondIsClosing = isMovingToward(second, first);
  if (firstIsClosing !== secondIsClosing) return firstIsClosing ? first : second;
  return Math.random() < 0.5 ? first : second;
}

function knockDown(pusher, victim) {
  const rightEdge = Math.max(0, window.innerWidth - WALKER_WIDTH);
  victim.x = Math.max(0, Math.min(rightEdge, victim.x + pusher.direction * 10));
  victim.element.style.transform = `translate3d(${victim.x}px, 0, 0)`;
  victim.isFallen = true;
  victim.element.classList.add('is-fallen');

  pusher.element.classList.remove('is-pushing');
  void pusher.element.offsetWidth;
  pusher.element.classList.add('is-pushing');
  setTimeout(() => pusher.element.classList.remove('is-pushing'), 300);
}

function resolveCollisions() {
  const walkers = [...people.values()].sort((first, second) => first.x - second.x);
  const contacts = new Set();
  const participants = new Set();

  for (let firstIndex = 0; firstIndex < walkers.length; firstIndex += 1) {
    const first = walkers[firstIndex];
    if (first.isFallen) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < walkers.length; secondIndex += 1) {
      const second = walkers[secondIndex];
      if (second.x - first.x > COLLISION_DISTANCE) break;
      if (second.isFallen) continue;

      const contact = pairKey(first, second);
      contacts.add(contact);
      if (activeContacts.has(contact) || participants.has(first) || participants.has(second)) continue;
      if (Math.random() >= COLLISION_FALL_CHANCE) continue;

      const pusher = choosePusher(first, second);
      const victim = pusher === first ? second : first;
      participants.add(pusher);
      participants.add(victim);
      knockDown(pusher, victim);
    }
  }

  activeContacts = contacts;
}

function animate(time) {
  animationFrame = 0;
  const elapsed = Math.min((time - (lastFrame || time)) / 1000, 0.05);
  lastFrame = time;
  const rightEdge = Math.max(0, window.innerWidth - WALKER_WIDTH);

  for (const person of people.values()) {
    if (!reducedMotion.matches && !person.isFallen) {
      person.x += person.speed * person.direction * elapsed;
      if (person.x <= 0 || person.x >= rightEdge) {
        person.x = Math.max(0, Math.min(rightEdge, person.x));
        person.direction *= -1;
        person.element.dataset.facing = person.direction < 0 ? 'left' : 'right';
      }
      person.element.style.transform = `translate3d(${person.x}px, 0, 0)`;
    }
    positionBubble(person);
  }

  if (!reducedMotion.matches) resolveCollisions();
  if (!reducedMotion.matches && [...people.values()].some((person) => !person.isFallen)) {
    animationFrame = requestAnimationFrame(animate);
  }
}

function startAnimation() {
  if (!animationFrame) {
    lastFrame = 0;
    animationFrame = requestAnimationFrame(animate);
  }
}

function setStatus(state) {
  status.textContent = ({
    connecting: 'Подключаемся к чату…',
    connected: `Чат #${channel} подключён`,
    reconnecting: 'Переподключаемся к чату…',
    unavailable: 'Чат недоступен',
    preview: 'Предпросмотр без подключения к чату',
    missing: 'Канал не выбран. Обновите страницу, чтобы ввести канал.',
  })[state] || '';
  status.dataset.state = state;
}

function connect() {
  disconnect?.();
  disconnect = connectToChat(channel, {
    onStatus: setStatus,
    onMessage: showMessage,
    onDelete: (id) => {
      if (!id) return;
      for (const person of people.values()) {
        if (person.bubbleId === id) hideBubble(person);
      }
    },
    onClear: (login) => {
      if (!login) {
        for (const person of people.values()) hideBubble(person);
        return;
      }
      for (const person of people.values()) {
        if (person.login === login.toLowerCase()) removePerson(person);
      }
    },
  });
}

setInterval(() => {
  const now = Date.now();
  for (const person of people.values()) {
    if (now - person.lastMessageAt >= IDLE_MS) removePerson(person);
  }
}, 1000);

window.addEventListener('resize', () => {
  const rightEdge = Math.max(0, window.innerWidth - WALKER_WIDTH);
  for (const person of people.values()) {
    person.x = Math.min(person.x, rightEdge);
    person.element.style.transform = `translate3d(${person.x}px, 0, 0)`;
    setBaseline(person);
    person.bubbleWidth = person.bubble.hidden ? 0 : person.bubble.offsetWidth;
    positionBubble(person);
  }
});

window.addEventListener('pagehide', () => disconnect?.());
window.addEventListener('pageshow', (event) => { if (event.persisted && channel && !previewMode) connect(); });
reducedMotion.addEventListener('change', startAnimation);

if (!channel) {
  setStatus('missing');
} else if (previewMode) {
  setStatus('preview');
  [
    { key: 'preview-1', login: 'sunnycat', name: 'SunnyCat', id: 'preview-1', message: 'Всем привет! 👋' },
    { key: 'preview-2', login: 'nightowl', name: 'NightOwl', id: 'preview-2', message: 'Какой уютный стрим сегодня.' },
    { key: 'preview-3', login: 'pixelfox', name: 'PixelFox', id: 'preview-3', message: 'Я тоже здесь!' },
  ].forEach(showMessage);
} else {
  connect();
}
