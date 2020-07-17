import { ApiPromise } from '@polkadot/api';

// A specific test case
abstract class ChainTest {
  // runDelay: # of blocks after upgrade to run the test
  constructor(
    public readonly name: string,
  ) { }

  // checks if the test has completed
  public isComplete(block: number): boolean {
    return block > Math.max(...Object.keys(this.tests).map((n) => +n));
  }

  public readonly tests: { [block: number]: (api: ApiPromise) => Promise<void> };
}

export default ChainTest;
