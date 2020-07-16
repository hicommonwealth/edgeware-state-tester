import { ApiPromise } from '@polkadot/api';

// A specific test case
abstract class MigrationTest {
  // runDelay: # of blocks after upgrade to run the test
  constructor(public runDelay: number) { }

	// checks if the test has completed
  public complete: boolean;

  // initialize the test, fetch chain data as needed and store it
  public abstract async init(api: ApiPromise);

  // run the test post-upgrade, compare the chain data from init with current data
	// and mark completed upon success
  public abstract async run(api: ApiPromise);
}

// Fixture to run test cases
class MigrationTester {
  private _api: ApiPromise;
  constructor(private tests: MigrationTest[]) { }

  private async _constructApi(): Promise<ApiPromise> {
    // TODO
    throw new Error('UNIMPLEMENTED');
  }

  private async _doUpgrade(): Promise<any> {
    // TODO
    throw new Error('UNIMPLEMENTED');
  }

  // construct API and initialize tests at some point in the chain's execution
  public async init() {
    this._api = await this._constructApi();
    await Promise.all(this.tests.map((t) => t.init(this._api)));
  }

  // perform an upgrade, then kick off a subscription to run all tests after
  // the provided delay
  public async upgrade() {
    await this._doUpgrade();

    // fetch upgrade time
    const upgradeHeader = await this._api.rpc.chain.getHeader();
    const upgradeBlock = +upgradeHeader.number;

    // subscribe to new blocks and run tests as they occur
    this._api.rpc.chain.subscribeNewHeads(async (header) => {
      const blockNumber = +header.number;
      const testsToRun = this.tests.filter((test) => blockNumber === test.runDelay + upgradeBlock);
      await Promise.all(testsToRun.map((t) => t.run(this._api)));
      if (this.tests.every((test) => test.complete)) {
        console.log('All tests complete!');
        process.exit(0);
      }
    });
  }
}

async function main() {
  // construct some migration tests
  const tests: MigrationTest[] = [];

  // construct tester
  const tester = new MigrationTester(tests);
  await tester.init();
  await tester.upgrade();
}

// kick off test script
main();