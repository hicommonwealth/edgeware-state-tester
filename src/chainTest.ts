import { ApiPromise, Keyring } from '@polkadot/api';

// A specific test case
abstract class ChainTest {
  protected readonly accounts: string[];

  // runDelay: # of blocks after upgrade to run the test
  constructor(
    // the publicly-displayable name of the test (usually set in the `super` call)
    public readonly name: string,

    // we use the accounts if we need to e.g. send a tx
    protected readonly accountSeeds: string[],
    protected readonly ss58Prefix: number,
  ) {
    // convert seeds to addresses for use in test cases
    this.accounts = accountSeeds.map((seed) => {
      return new Keyring({ ss58Format: ss58Prefix }).addFromMnemonic(seed).address;
    });
  }

  // checks if the test has completed
  public isComplete(block: number): boolean {
    const finalTestBlock = Math.max(...Object.keys(this.actions).map((n) => +n));
    return block > finalTestBlock;
  }

  public readonly actions: { [block: number]: {
    name: string,
    fn: (api: ApiPromise) => Promise<void>,
  } };
}

export default ChainTest;
