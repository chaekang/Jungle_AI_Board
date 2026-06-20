import { parseTrustProxyHops } from './trust-proxy';

describe('parseTrustProxyHops', () => {
  it('returns a positive integer when configured', () => {
    expect(parseTrustProxyHops('1')).toBe(1);
  });

  it('ignores empty or invalid values', () => {
    expect(parseTrustProxyHops()).toBeUndefined();
    expect(parseTrustProxyHops('')).toBeUndefined();
    expect(parseTrustProxyHops('0')).toBeUndefined();
    expect(parseTrustProxyHops('abc')).toBeUndefined();
  });
});
