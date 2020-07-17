import { ApiPromise } from '@polkadot/api';
import chai from 'chai';
import ChainTest from '../chainTest';

class BalanceQueryTest extends ChainTest {
  private readonly _address = 'hwR8hAatmmdupBLXQSxLUPBa8GhRomLD9hf6iRtFeXs8fcY';
  private _bal: string;

  constructor() {
    super('Balance Query Test');
  }

  public readonly tests = {
    5: async (api: ApiPromise) => {
      const bal = await api.query.balances.account(this._address);
      this._bal = JSON.stringify(bal);
    },
    10: async (api: ApiPromise) => {
      const bal = await api.query.balances.account(this._address);
      chai.assert.equal(this._bal, JSON.stringify(bal));
    }
  }
}

export default BalanceQueryTest;
