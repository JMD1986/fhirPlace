declare module 'jest-axe' {
  import { MatcherFunction } from 'expect';
  export const axe: any;
  export const toHaveNoViolations: MatcherFunction;
}