import { describe, expect, it } from 'vitest';
import { cssKapsamla } from './ozelGorunum';

const K = '[data-axt-css="x"]';

describe('özel CSS kapsamı', () => {
  it('her seçici widget kökünün altına alınır', () => {
    expect(cssKapsamla('.balon, p { color: red }', K)).toBe(`${K} .balon, ${K} p { color: red }\n`);
  });

  it(':kok / :root / & kökün kendisidir', () => {
    expect(cssKapsamla(':kok { padding: 4px } :root .a { x: 1 } &:hover { y: 2 }', K)).toBe(
      `${K} { padding: 4px }\n${K} .a { x: 1 }\n${K}:hover { y: 2 }\n`
    );
  });

  it('@media içine iner, @keyframes olduğu gibi kalır', () => {
    const c = cssKapsamla('@media (max-width: 500px) { .a { b: 1 } .c { d: 2 } } @keyframes z { from { o: 0 } to { o: 1 } }', K);
    expect(c).toContain(`@media (max-width: 500px) {${K} .a { b: 1 }\n${K} .c { d: 2 }\n}`);
    expect(c).toContain('@keyframes z { from { o: 0 } to { o: 1 } }');
  });

  it('@import, yorum ve </style> atılır', () => {
    const c = cssKapsamla('@import url(http://x/y.css); /* not */ .a { b: 1 } </style><script>', K);
    expect(c).not.toMatch(/@import|not|<\/style|<script/);
    expect(c).toContain(`${K} .a { b: 1 }`);
  });
});
