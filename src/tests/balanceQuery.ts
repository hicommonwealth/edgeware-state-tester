import { ApiPromise } from '@polkadot/api';
import chai from 'chai';
import MigrationTest from '../migrationTest';

class BalanceQueryTest extends MigrationTest {
  private readonly _address = 'hwR8hAatmmdupBLXQSxLUPBa8GhRomLD9hf6iRtFeXs8fcY';
  private _bal;

  constructor() {
    super('Balance Query Test', 3);
  }

  public async init(api: ApiPromise) {
    const bal = await api.query.balances.account(this._address);
    this._bal = JSON.stringify(bal);
  }

  public async run(api: ApiPromise) {
    const bal = await api.query.balances.account(this._address);
    chai.assert.equal(this._bal, JSON.stringify(bal));
    this._complete = true;
  }
}

export default BalanceQueryTest;
