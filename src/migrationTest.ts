import { ApiPromise } from '@polkadot/api';

// XOR type, one of the three
export enum DelayType {
  Blocks,
  Sessions,
  Eras
}

// A specific test case
abstract class MigrationTest {
  // runDelay: # of blocks after upgrade to run the test
  constructor(
    public readonly name: string,
    public readonly delayType: DelayType,
    public readonly delayLength: number,
  ) { }

  // checks if the test has completed
  protected _complete: boolean = false;
  public get complete(): boolean { return this._complete; }

  // initialize the test, fetch chain data as needed and store it
  public abstract async init(api: ApiPromise);

  // run the test post-upgrade, compare the chain data from init with current data
  // and mark completed upon success
  public abstract async run(api: ApiPromise);
}

export default MigrationTest;
