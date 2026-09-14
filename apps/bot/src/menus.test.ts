import { describe, expect, test } from 'vitest';
import { appLinkFor } from './menus';

describe('appLinkFor', () => {
  test('https dashboard yields a web_app link', () => {
    const link = appLinkFor('https://tgpulse.app/app', '');
    expect(link).toEqual({ url: 'https://tgpulse.app/app', kind: 'web_app' });
  });

  test('http dashboard (local dev) falls back to a plain url button', () => {
    const link = appLinkFor('http://localhost:3000/app', '');
    expect(link).toEqual({ url: 'http://localhost:3000/app', kind: 'url' });
  });

  test('appends a path relative to /app', () => {
    const link = appLinkFor('https://tgpulse.app/app', '/channels/abc/integrations');
    expect(link.url).toBe('https://tgpulse.app/app/channels/abc/integrations');
  });

  test('keeps query strings intact', () => {
    const link = appLinkFor('https://tgpulse.app/app', '/team?ws=ws_1');
    expect(link.url).toBe('https://tgpulse.app/app/team?ws=ws_1');
  });

  test('tolerates a trailing slash on the dashboard url', () => {
    const link = appLinkFor('https://tgpulse.app/app/', '/billing');
    expect(link.url).toBe('https://tgpulse.app/app/billing');
  });

  test('adds the /app segment when the dashboard url is a bare origin', () => {
    const link = appLinkFor('https://tgpulse.app', '/billing');
    expect(link.url).toBe('https://tgpulse.app/app/billing');
  });

  test('is case-insensitive about the scheme', () => {
    expect(appLinkFor('HTTPS://tgpulse.app/app', '').kind).toBe('web_app');
  });
});
