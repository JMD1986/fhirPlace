declare module 'jest-axe' {
  import type { AxeResults } from 'axe-core';
  import type { MatcherFunction } from 'expect';
  export const axe: (html: Element | string) => Promise<AxeResults>;
  export const toHaveNoViolations: MatcherFunction;
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}