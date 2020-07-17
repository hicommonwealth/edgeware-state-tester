import { ApiPromise } from '@polkadot/api';
import chai from 'chai';
import ChainTest from '../chainTest';

class BalanceQueryTest extends ChainTest {
  private _bal: string;

  constructor(accountSeeds: string[], ss58Prefix: number) {
    super('Balance Query Test', accountSeeds, ss58Prefix);
    if (accountSeeds.length === 0) throw new Error(`${this.name} requires at least one account!`);
  }

  public readonly actions = {
    2: {
      name: 'fetch initial account balances',
      fn: async (api: ApiPromise) => {
        const bal = await api.query.balances.account(this.account(0));
        this._bal = JSON.stringify(bal);
      },
    },
    5: {
      name: 'ensure balances equal',
      fn: async (api: ApiPromise) => {
        const bal = await api.query.balances.account(this.account(0));
        chai.assert.equal(this._bal, JSON.stringify(bal));
      }
    }
  }
}

export default BalanceQueryTest;
