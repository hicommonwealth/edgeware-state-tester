import { ApiPromise } from '@polkadot/api';
import { xxhashAsHex } from '@polkadot/util-crypto';
import chai from 'chai';
import StateTest from '../stateTest';

class BalanceQueryTest extends StateTest {
  private _bal: string;

  constructor(accountSeeds: string[], ss58Prefix: number) {
    super('Balance Query Test', accountSeeds, ss58Prefix);
    if (accountSeeds.length === 0) throw new Error(`${this.name} requires at least one account!`);
  }

  // We're testing a migration that does the following:
  // - For accounts with Balances::FreeBalance, fetch old locks from Balances::Locks, update their
  //    format, update Democracy::Locks, Balances::Locks, create Balances::Account. 
  // - For accounts with Balances::ReservedBalance, create/update Balances::Account
  // - For accounts with Balances::Vesting, update Balances::Account, Balances::Locks and create
  //    Vesting::Vesting with same data
  // - Finally, rename Balances::Account to System::Account
  public readonly actions = {
    2: {
      name: 'initialize balance data',
      fn: async (api: ApiPromise) => {

      },
    },
    4: {
      name: 'fetch initial storage',
      fn: async (api: ApiPromise) => {

      },
    },
    5: {
      name: 'fetch updated storage and ensure match',
      fn: async (api: ApiPromise) => {

      }
    }
  }
}

export default BalanceQueryTest;
