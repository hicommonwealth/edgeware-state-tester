import child_process from 'child_process';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import TestRunner from './testRunner';
import ChainTest from './chainTest';

const CHAINSPEC = 'dev';
const BINARY_PATH = '../edgeware-node/target/release/edgeware';
const UPGRADE_BINARY = null;
const UPGRADE_BLOCK = null;
const CHAIN_BASE_PATH = './chain-db';
const ACCOUNTS = [ '//Alice' ];
const SS58_PREFIX = 0;

const URL = 'ws://localhost:9944';
let PROC: child_process.ChildProcess;
let PROC_OUTSTREAM: fs.WriteStream;

function startChain() {
  // clear base path and replace with an empty directory
  if (fs.existsSync(CHAIN_BASE_PATH)) {
    rimraf.sync(CHAIN_BASE_PATH);
  }
  fs.mkdirSync(CHAIN_BASE_PATH);

  // open log files for chain output streams
  PROC_OUTSTREAM = fs.createWriteStream(path.join(CHAIN_BASE_PATH, 'out.log'));

  // start the chain
  const args = [
    '--chain', CHAINSPEC,
    '--base-path', CHAIN_BASE_PATH,
    '--alice', // TODO: abstract this;
  ];
  console.log('Executing', BINARY_PATH, 'with args', args);
  PROC = child_process.execFile(BINARY_PATH, args, { }, (error) => {
    if (error) console.log(`Received chain process error: ${error.message}.`);
    console.log('Chain exited.');
  });

  // pipe edgeware output to files in temp dir
  PROC.stdout.pipe(PROC_OUTSTREAM);
  PROC.stderr.pipe(PROC_OUTSTREAM);
}

async function main() {
  // construct some migration tests
  // TODO: make this a part of the arg initialization
  const tests: ChainTest[] = [];
  const BalanceQueryTest = (await import('./tests/balanceQuery')).default;
  tests.push(new BalanceQueryTest(ACCOUNTS, SS58_PREFIX));

  // construct tester
  const tester = new TestRunner(tests, UPGRADE_BINARY, UPGRADE_BLOCK);

  // start the chain using specified parameters
  startChain();

  // run the tests
  await tester.run(URL);

  // once the tests are completed, stop the chain and quit
  PROC.kill(9);
  console.log(`Run finished, view chain output at ${PROC_OUTSTREAM.path}`);
  PROC_OUTSTREAM.close();

  process.exit(0);
}

// kick off test script
main();
