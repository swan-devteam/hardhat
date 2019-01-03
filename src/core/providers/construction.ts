import {
  HDAccountsConfig,
  HttpNetworkConfig,
  NetworkConfigAccounts,
  Networks
} from "../../types";
import { BuidlerError, ERRORS } from "../errors";

import { IEthereumProvider } from "./ethereum";

export function isHDAccountsConfig(
  accounts?: NetworkConfigAccounts
): accounts is HDAccountsConfig {
  return accounts !== undefined && Object.keys(accounts).includes("mnemonic");
}

export function createProvider(
  selectedNetwork: string,
  networksConfig?: Networks
): IEthereumProvider {
  if (
    networksConfig === undefined ||
    networksConfig[selectedNetwork] === undefined
  ) {
    throw new BuidlerError(ERRORS.NETWORK_CONFIG_NOT_FOUND, selectedNetwork);
  }

  if (selectedNetwork === "auto") {
    throw new Error("Network auto not yet supported");
  }

  const netConfig = networksConfig[selectedNetwork] as HttpNetworkConfig;

  // These dependencies are lazy-loaded because they are really big.
  // We use require() instead of import() here, because we need it to be sync.

  const { HttpProvider } = require("web3x/providers");

  const baseProvider = new HttpProvider(
    netConfig.url || "http://localhost:8545"
  );

  // TODO: This may break, the base provider is not an IEthereumProvider
  const provider: IEthereumProvider = baseProvider as any;

  return wrapEthereumProvider(provider, netConfig);
}

export function wrapEthereumProvider(
  provider: IEthereumProvider,
  netConfig: HttpNetworkConfig
): IEthereumProvider {
  // These dependencies are lazy-loaded because they are really big.
  // We use require() instead of import() here, because we need it to be sync.

  const {
    createHDWalletProvider,
    createLocalAccountsProvider,
    createSenderProvider
  } = require("./accounts");

  const {
    createAutomaticGasPriceProvider,
    createAutomaticGasProvider,
    createFixedGasPriceProvider,
    createFixedGasProvider
  } = require("./gas-providers");

  const { createNetworkProvider } = require("./network");

  const accounts = netConfig.accounts;
  if (Array.isArray(accounts)) {
    provider = createLocalAccountsProvider(provider, accounts);
  } else if (isHDAccountsConfig(accounts)) {
    provider = createHDWalletProvider(
      provider,
      accounts.mnemonic,
      accounts.path,
      accounts.initialIndex,
      accounts.count
    );
  }

  // TODO: Add some extension mechanism for account plugins here

  provider = createSenderProvider(provider, netConfig.from);

  if (netConfig.gas === undefined || netConfig.gas === "auto") {
    provider = createAutomaticGasProvider(provider);
  } else {
    provider = createFixedGasProvider(provider, netConfig.gas);
  }

  if (netConfig.gasPrice === undefined || netConfig.gasPrice === "auto") {
    provider = createAutomaticGasPriceProvider(provider);
  } else {
    provider = createFixedGasPriceProvider(provider, netConfig.gasPrice);
  }

  return createNetworkProvider(provider, netConfig.chainId);
}
