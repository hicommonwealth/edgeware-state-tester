import { ApiPromise, WsProvider } from '@polkadot/api';
import { UnsubscribePromise } from '@polkadot/api/types';
import { TypeRegistry } from '@polkadot/types';
import * as EdgDefs from '@edgeware/node-types/interfaces/definitions';
import ChainTest from './chainTest';

class TestRunner {
  private _api: ApiPromise;
  constructor(
    // set of tests to run
    private tests: ChainTest[],

    // optional upgrade info, if present will run an upgrade
    private upgradeBinPath?: string,
    private upgradeBlock?: number,
  ) {
    if (upgradeBinPath && upgradeBlock) {
      console.log(`Will upgrade on block ${upgradeBlock} from ${upgradeBinPath}.`);
    } else {
      console.log('Will not perform upgrade during testing.');
    }
  }

  // TODO: figure out how to re-construct api pre/post upgrade
  // using different sets of types
  private async _constructApi(url: string): Promise<ApiPromise> {
    // initialize provider and wait for connection
    const provider = new WsProvider(url);
    let unsubscribe: () => void;
    await new Promise((resolve) => {
      unsubscribe = provider.on('connected', () => resolve());
    });
    unsubscribe();

    // using provider, initialize the full API
    const edgTypes: { [name: string]: string } = Object.values(EdgDefs)
      .reduce((res, { types }) => ({ ...res, ...types }), {});
    const api = new ApiPromise({
      provider,
      registry: new TypeRegistry(),
      types: {
        ...edgTypes,

        // overrides for scoped types
        'voting::VoteType': 'VoteType',
        'voting::TallyType': 'TallyType',

        // overrides for old types
        Address: 'GenericAddress',
        Keys: 'SessionKeys4',
        StakingLedger: 'StakingLedgerTo223',
        Votes: 'VotesTo230',
        ReferendumInfo: 'ReferendumInfoTo239',
        Weight: 'u32',
        OpenTip: 'OpenTipTo225'
      }
    });
    return api.isReady;
  }

  private async _doUpgrade(): Promise<any> {
    // TODO
    console.log('Performing upgrade...');
  }

  // construct API and initialize tests at some point in the chain's execution
  public async run(url: string) {
    console.log(`Connecting to chain at ${url}...`);
    this._api = await this._constructApi(url);
    console.log(`Connected to chain at ${url}.`);

    // subscribe to new blocks and run tests as they occur
    let rpcSubscription: UnsubscribePromise;
    const testCompleteP = new Promise((resolve) => {
      rpcSubscription = this._api.rpc.chain.subscribeNewHeads(async (header) => {
        const blockNumber = +header.number;
        console.log(`Got block ${blockNumber}.`);

        // perform upgrade after delay
        if (this.upgradeBinPath && blockNumber === this.upgradeBlock) {
          await this._doUpgrade();
        }

        const runnableTests = this.tests.filter((t) => !!t.actions[blockNumber]);
        // run the selected tests
        await Promise.all(runnableTests.map(async (t) => {
          const { name, fn } = t.actions[blockNumber];
          try {
            await fn(this._api);
            console.log(`Test '${t.name}' action '${name}' succeeded.`);
          } catch (e) {
            console.log(`Test '${t.name}' action '${name}' failed: ${e.message}.`);
          }
        }));
        if (this.tests.every((test) => test.isComplete(blockNumber))) {
          console.log('All tests complete!');
          resolve();
        }
      });
    });

    // wait for the tests to complete
    await testCompleteP;

    // once all tests complete, kill the chain subscription
    if (rpcSubscription) await rpcSubscription;
  }
}

export default TestRunner;
