import TestRunner from './testRunner';
import ChainTest from './chainTest';

async function main() {
  // construct some migration tests
  const tests: ChainTest[] = [];
  const BalanceQueryTest = (await import('./tests/balanceQuery')).default;
  tests.push(new BalanceQueryTest());

  // construct tester
  const tester = new TestRunner(tests, 7);
  await tester.init('ws://mainnet1.edgewa.re:9944');
}

// kick off test script
main();
