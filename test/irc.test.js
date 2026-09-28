import test from 'node:test';
import assert from 'node:assert/strict';
import { getChatMessage, parseIrcLine } from '../src/irc.js';
import { parseChannelInput } from '../src/channel.js';

test('accepts a Twitch channel name or channel link without trusting other URLs', () => {
  assert.equal(parseChannelInput('  @My_Channel  '), 'my_channel');
  assert.equal(parseChannelInput('https://www.twitch.tv/My_Channel?ref=share'), 'my_channel');
  assert.equal(parseChannelInput('twitch.tv/My_Channel/'), 'my_channel');
  assert.equal(parseChannelInput('https://twitch.tv.evil.test/My_Channel'), null);
  assert.equal(parseChannelInput('name\r\nJOIN #other'), null);
  assert.equal(parseChannelInput('https://www.twitch.tv/name/videos'), null);
});

test('parses a tagged Twitch message and keeps text as plain data', () => {
  const line = '@display-name=Тестовый\\sзритель;id=message-1;user-id=123 '
    + ':viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #ivelknow :<img src=x onerror=alert(1)> привет';
  const message = getChatMessage(parseIrcLine(line), 'ivelknow');

  assert.deepEqual(message, {
    key: '123',
    login: 'viewer',
    name: 'Тестовый зритель',
    id: 'message-1',
    message: '<img src=x onerror=alert(1)> привет',
  });
});

test('ignores messages for other channels and removes IRC action markers', () => {
  const line = ':viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #another :hello';
  assert.equal(getChatMessage(parseIrcLine(line), 'ivelknow'), null);

  const action = ':viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #ivelknow :\u0001ACTION waves\u0001';
  assert.equal(getChatMessage(parseIrcLine(action), 'ivelknow')?.message, 'waves');
});

test('parses moderation message identifiers', () => {
  const line = '@target-msg-id=message-1 :tmi.twitch.tv CLEARMSG #ivelknow :removed text';
  const parsed = parseIrcLine(line);
  assert.equal(parsed.command, 'CLEARMSG');
  assert.equal(parsed.tags['target-msg-id'], 'message-1');
  assert.equal(parsed.params[0], '#ivelknow');
});
