import { ApiPromise, WsProvider } from '@polkadot/api';
import { TypeRegistry } from '@polkadot/types';
import * as EdgDefs from '@edgeware/node-types/interfaces/definitions';
import MigrationTest, { DelayType } from './migrationTest';

// Fixture to run test cases
class MigrationTester {
  private _api: ApiPromise;
  private _session: number;
  private _era: number;
  constructor(private tests: MigrationTest[]) { }

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
    await Promise.all(this.tests.map((t) => t.init(this._api)));
  }

  // perform an upgrade, then kick off a subscription to run all tests after
  // the provided delay
  public async upgrade(upgradeDelay: number) {
    // fetch current block #
    const currentHeader = await this._api.rpc.chain.getHeader();
    const startBlock = +currentHeader.number + upgradeDelay;
    const currentSessionEraInfo = await this._api.derive.session.indexes();
    const startSession = +currentSessionEraInfo.currentIndex;
    const startEra = +currentSessionEraInfo.currentEra;

    // subscribe to new blocks and run tests as they occur
    this._api.rpc.chain.subscribeNewHeads(async (header) => {
      const blockNumber = +header.number;
      console.log(`Got block ${blockNumber}.`);
      const sessionEraInfo = await this._api.derive.session.indexes();

      // perform upgrade after delay
      if (blockNumber === startBlock) {
        await this._doUpgrade();
      }

      // discover any tests that need to be run (TODO: sort rather than filter every block)
      const testsToRun: MigrationTest[] = [];

      // add session-based tests
      if (this._session !== +sessionEraInfo.currentIndex) {
        this._session = +sessionEraInfo.currentIndex;
        testsToRun.push(...this.tests.filter((test) => test.delayType === DelayType.Sessions
          && test.delayLength === (this._session - startSession)));
      }

      // add era-based tests
      if (this._era !== +sessionEraInfo.currentEra) {
        this._era = +sessionEraInfo.currentEra;
        testsToRun.push(...this.tests.filter((test) => test.delayType === DelayType.Eras
          && test.delayLength === (this._era - startEra)));
      }

      // add block-based tests
      testsToRun.push(...this.tests.filter((test) => test.delayType === DelayType.Blocks
        && test.delayLength === (blockNumber - startBlock)));

      // run the selected tests
      await Promise.all(testsToRun.map(async (t) => {
        try {
          await t.run(this._api);
          console.log(`Test '${t.name}' succeeded.`);
        } catch (e) {
          console.log(`Test '${t.name}' failed: ${e.message}.`);
        }
      }));
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
  const BalanceQueryTest = (await import('./tests/balanceQuery')).default;
  tests.push(new BalanceQueryTest());

  // construct tester
  const tester = new MigrationTester(tests);
  await tester.init('ws://mainnet1.edgewa.re:9944');
  await tester.upgrade(2);
}

// kick off test script
main();
