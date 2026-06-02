// src/test-utils/index.ts
// Central export for test utilities

export {
  TestMemoryRouter,
  TestBrowserRouter,
  TestHashRouter,
  ROUTER_FUTURE_FLAGS,
  withRouter,
} from './routerTestUtils';

export {
  getA11yViolations,
  expectNoA11yViolations,
  WCAG_2_1_AA_TAGS,
  type A11yCheckOptions,
} from './axeHelper';
