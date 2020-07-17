import { ApiPromise, WsProvider } from '@polkadot/api';
import { TypeRegistry } from '@polkadot/types';
import * as EdgDefs from '@edgeware/node-types/interfaces/definitions';
import ChainTest from './chainTest';

class TestRunner {
  private _api: ApiPromise;
  constructor(private tests: ChainTest[], private upgradeBlock: number) { }

  // TODO: figure out how to re-construct api pre/post upgrade
  // using different sets of types
  private _constructApi(url: string): Promise<ApiPromise> {
    const edgTypes: { [name: string]: string } = Object.values(EdgDefs)
      .reduce((res, { types }) => ({ ...res, ...types }), {});
    const api = new ApiPromise({
      provider: new WsProvider(url),
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
  public async init(url: string) {
    this._api = await this._constructApi(url);
    console.log(`Connected to chain at ${url}.`);

    // subscribe to new blocks and run tests as they occur
    this._api.rpc.chain.subscribeNewHeads(async (header) => {
      const blockNumber = +header.number;
      console.log(`Got block ${blockNumber}.`);

      // perform upgrade after delay
      if (blockNumber === this.upgradeBlock) {
        await this._doUpgrade();
      }

      const testsToRun = this.tests
        .map((t) => t.tests[blockNumber]) // get all tests runnable at this block
        .filter((f) => !!f);              // remove undefined tests
      // run the selected tests
      await Promise.all(testsToRun.map(async (t) => {
        try {
          await t(this._api);
          console.log(`Test '${t.name}' succeeded.`);
        } catch (e) {
          console.log(`Test '${t.name}' failed: ${e.message}.`);
        }
      }));
      if (this.tests.every((test) => test.isComplete(blockNumber))) {
        console.log('All tests complete!');
        process.exit(0);
      }
    });
  }
}

export default TestRunner;
