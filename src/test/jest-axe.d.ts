import type { AxeResults } from "axe-core";
import type { MatcherFunction } from "expect";

export const axe: (html: string) => Promise<AxeResults>;
export const toHaveNoViolations: MatcherFunction;

declare global {
  // Extend Jest expect namespace with toHaveNoViolations for TypeScript
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}

export {};
declare module 'jest-axe' {
  import { MatcherFunction } from 'expect';
  export const axe: any;
  export const toHaveNoViolations: MatcherFunction;
}