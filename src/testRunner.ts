import child_process from 'child_process';
import fs from 'fs';
import rimraf from 'rimraf';

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { UnsubscribePromise } from '@polkadot/api/types';
import { TypeRegistry } from '@polkadot/types';
import * as EdgDefs from '@edgeware/node-types/interfaces/definitions';
import ChainTest from './chainTest';

// configuration options for test runner
export interface ITestOptions {
  // spec of chain to run, should be 'dev' for test chains
  chainspec: string;

  // path to the `edgeware` binary
  binaryPath: string;

  // path to a directory to initialize the chain database
  chainBasePath: string;

  // list of account seeds to pass into tests
  accountSeeds: string[];

  // prefix used in SS58 address generation, 0 on test chains
  ss58Prefix: number;

  // websocket url exposed by a running chain, used to initialize the polkadot API
  // defaults to 'ws://localhost:9944'
  wsUrl?: string;

  // path or stream specifier to pipe chain stdout/stderr into.
  // leave undefined to ignore chain output
  chainLogPath?: string | 'stdout' | 'stderr';

  // upgrade-specific configuration:
  upgrade?: {
    // path to a file containing the WASM hex string used in `setCode`
    codePath: string,

    // block to send upgrade tx
    block: number;

    // seed of sudo account, which can execute `setCode`
    sudoSeed: string;

    // path to the binary file containing the upgraded chain executable
    // leave blank to upgrade without requiring a chain restart/change in chain binary
    binaryPath?: string;
  }
}

// Testing fixture for automating chain and API startup and upgrades
// such that general tests can run against it, maintaining state across
// API sessions and upgrades.
class TestRunner {
  private _api: ApiPromise;
  private _chainOutfile: fs.WriteStream;
  private _chainOutstream: NodeJS.WritableStream;
  private _chainProcess: child_process.ChildProcess;

  constructor(
    private tests: ChainTest[],
    private options: ITestOptions,
  ) {
    if (options.upgrade) {
      console.log(`Will perform upgrade on block ${options.upgrade.block}.`);
    } else {
      console.log('Will not perform upgrade during testing.');
    }
    if (!options.wsUrl) {
      console.log('Defaulting chain URL to ws://localhost:9944.');
      options.wsUrl = 'ws://localhost:9944';
    }
  }

  // Starts a chain and configures its output to write to a given location, as
  // specified in the options object.
  // 'clearBasePath' is set to true to remove the chain database at startup,
  //   for a clean start, whereas post-upgrade it should be false.
  private _startChain(clearBasePath: boolean) {
    if (clearBasePath) {
      // clear base path and replace with an empty directory
      if (fs.existsSync(this.options.chainBasePath)) {
        // we use rimraf because fs.remove doesn't support recursive removal
        rimraf.sync(this.options.chainBasePath);
      }
      fs.mkdirSync(this.options.chainBasePath);
    }

    // open log files if necessary to configure the chain output stream
    if (this.options.chainLogPath === 'stdout') {
      this._chainOutstream = process.stdout;
    } else if (this.options.chainLogPath === 'stderr') {
      this._chainOutstream = process.stderr;
    } else if (this.options.chainLogPath) {
      // we set the 'a' flag to avoid overwriting the file when we re-init this
      // file stream on upgrade
      this._chainOutfile = fs.createWriteStream(this.options.chainLogPath, { flags: 'a' });
      this._chainOutstream = this._chainOutfile;
    }

    // start the chain with specified spec and basepath
    const args = [
      '--chain', this.options.chainspec,
      '--base-path', this.options.chainBasePath,
      '--alice', // TODO: abstract this into accounts somehow
    ];
    console.log('Executing', this.options.binaryPath, 'with args', args);
    this._chainProcess = child_process.execFile(this.options.binaryPath, args, { }, (error) => {
      // callback on exit
      if (error) console.log(`Received chain process error: ${error.message}.`);
      console.log('Chain exited.');
    });

    // pipe edgeware output to file in temp dir/process output if set
    if (this._chainOutstream) {
      this._chainProcess.stdout.pipe(this._chainOutstream);
      this._chainProcess.stderr.pipe(this._chainOutstream);
    }
  }

  // Stops an active chain and closes any file used to store its output.
  private _stopChain() {
    if (this._chainProcess) {
      this._chainProcess.kill(9);
      delete this._chainProcess;
    }
    if (this._chainOutstream) {
      delete this._chainOutstream;
    }
    if (this._chainOutfile) {
      this._chainOutfile.close();
      delete this._chainOutfile;
    }
  }

  // With a valid chain running, construct a polkadot-js API and
  // initialize a connection to the chain.
  // 'useOldOverrides' is currently a hack to support different type overrides
  //   for existing Substrate types, and should be replaced eventually with an
  //   "additionalTypes" argument, for more general usage.
  private async _startApi(useOldOverrides: boolean): Promise<void> {
    console.log(`Connecting to chain at ${this.options.wsUrl}...`);

    // initialize provider separately from the API: the API throws an error
    // if the chain is not available immediately
    const provider = new WsProvider(this.options.wsUrl);

    // this promise waits for the provider to connect to the chain, and then
    // removes the listener for 'connected' events.
    let unsubscribe: () => void;
    await new Promise((resolve) => {
      unsubscribe = provider.on('connected', () => resolve());
    });
    unsubscribe();

    // configure edgeware types -- pull from @edgeware/node-types
    const edgTypes: { [name: string]: string } = Object.values(EdgDefs)
      .reduce((res, { types }) => ({ ...res, ...types }), {});
    let types = {
      ...edgTypes,

      // overrides for scoped types
      'voting::VoteType': 'VoteType',
      'voting::TallyType': 'TallyType',
    };

    // These are overrides for default types, where edgeware is running
    // an older version of modules than the current substrate. These will
    // need to be maintained as the API upgrades the set of default types.
    if (useOldOverrides) {
      types = Object.assign(types, {

        // overrides for old types
        Address: 'GenericAddress',
        Keys: 'SessionKeys4',
        StakingLedger: 'StakingLedgerTo223',
        Votes: 'VotesTo230',
        ReferendumInfo: 'ReferendumInfoTo239',
        Weight: 'u32',
        OpenTip: 'OpenTipTo225',
      });
    } else {
      types = Object.assign(types, {
        OpenTip: 'OpenTipTo225',
      });
    }

    // initialize the API itself
    const registry = new TypeRegistry();
    this._api = new ApiPromise({ provider, registry, types });
    await this._api.isReady;
  }

  // Disconnect an active polkadot-js API from the chain.
  private _stopApi() {
    if (this._api) {
      this._api.disconnect();
    }
    delete this._api;
  }

  // Performs an upgrade via a `sudo(setCode())` API call.
  // 'useCodeChecks' specifies whether to perform API-level checks on the WASM blob,
  //   and should be set to false for the current edgeware upgrade.
  private async _doUpgrade(useCodeChecks: boolean): Promise<any> {
    if (!this.options.upgrade) {
      console.log('No upgrade to perform!');
      return;
    }

    console.log('Performing upgrade...');
    const { sudoSeed, codePath } = this.options.upgrade;

    // construct sudo-er keyring
    const sudoKey = new Keyring().addFromMnemonic(sudoSeed);

    // read WASM blob into memory
    const wasmFileData = fs.readFileSync(codePath);
    const wasmHex = `0x${wasmFileData.toString('hex')}`;
    console.log(`Upgrade bytes: ${wasmHex.length}`);

    // construct upgrade call that sudo will run
    const upgradeCall = useCodeChecks
      ? this._api.tx.system.setCode(wasmHex)
      : this._api.tx.system.setCodeWithoutChecks(wasmHex);

    // construct and submit sudo call using the sudo seed
    const sudoCall = this._api.tx.sudo.sudo(upgradeCall.method);
    const hash = await sudoCall.signAndSend(sudoKey);
    console.log(`Upgrade performed with hash ${hash}!`);
  }

  // with a valid chain and API connection, init tests
  private async _runTests(): Promise<boolean> {
    if (!this._api) throw new Error('API not initialized!');

    let rpcSubscription: UnsubscribePromise;
    // subscribe to new blocks and run tests as they occur
    // Promise resolves to "true" if an upgrade is pending,
    //   otherwise "false" if testing is completed.
    const testCompleteP: Promise<boolean> = new Promise((resolve) => {
      rpcSubscription = this._api.rpc.chain.subscribeNewHeads(async (header) => {
        const blockNumber = +header.number;
        console.log(`Got block ${blockNumber}.`);

        // perform upgrade after delay
        if (this.options.upgrade && blockNumber === this.options.upgrade.block) {
          resolve(true);
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
          resolve(false);
        }
      });
    });

    // wait for the tests to complete
    const needsUpgrade = await testCompleteP;

    // once all tests complete, kill the chain subscription
    if (rpcSubscription) await rpcSubscription;
    return needsUpgrade;
  }

  // main function to begin the testing process
  public async run() {
    // 1. Prepare chain directories and chain output file (if used),
    //    then start the chain.
    this._startChain(true);

    // 3. Construct API via websockets
    await this._startApi(true);

    // 4. Run tests via API
    const needsUpgrade = await this._runTests();

    // end run if no upgrade needed
    if (!needsUpgrade) {
      this._stopApi();
      this._stopChain();
      process.exit(0);
    }

    // [5.] Upgrade chain via API (false = do not use code checks, for now)
    await this._doUpgrade(false);

    // [6.] Restart chain with upgraded binary (if needed)
    this._stopApi();
    if (this.options.upgrade.binaryPath
        && this.options.binaryPath !== this.options.upgrade.binaryPath) {
      this._stopChain();
      this.options.binaryPath = this.options.upgrade.binaryPath;
      this._startChain(false);
    }

    // [7.] Reconstruct API (TODO: configure types specifically here)
    await this._startApi(false);

    // [8.] Run additional tests post-upgrade
    await this._runTests();

    // Cleanup and exit
    this._stopApi();
    this._stopChain();
    process.exit(0);
  }
}

export default TestRunner;
