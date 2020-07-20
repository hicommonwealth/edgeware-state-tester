import path from 'path';
import TestRunner from './testRunner';
import StateTest from './stateTest';

const CHAINSPEC = 'dev';
const BINARY_PATH = '../edgeware-node/target/release/edgeware';
const CHAIN_BASE_PATH = './chain-db';
const ACCOUNTS = [ '//Alice' ];
const SS58_PREFIX = 42; // default for testing chain specs

const UPGRADE_BINARY = '../edgeware-node-time-travel/target/release/edgeware';
const UPGRADE_BLOCK = 3;
const UPGRADE_CODE = './test_runtime.wasm';
const SUDO_SEED = '//Alice';

async function main() {
  // construct some migration tests
  // TODO: make this a part of the arg initialization
  const tests: StateTest[] = [];
  const BalanceQueryTest = (await import('./tests/balanceQuery')).default;
  tests.push(new BalanceQueryTest(ACCOUNTS, SS58_PREFIX));

  // construct tester
  const tester = new TestRunner(tests, {
    chainspec: CHAINSPEC,
    binaryPath: BINARY_PATH,
    chainBasePath: CHAIN_BASE_PATH,
    accountSeeds: ACCOUNTS,
    ss58Prefix: SS58_PREFIX,
    chainLogPath: path.join(CHAIN_BASE_PATH, 'out.log'),
    // upgrade: null,
    upgrade: {
      codePath: UPGRADE_CODE,
      binaryPath: UPGRADE_BINARY,
      block: UPGRADE_BLOCK,
      sudoSeed: SUDO_SEED,
    },
  });

  await tester.run();
}

// kick off test script
main();
