import {
  AbstractCurrency,
  Binance,
  ChainId,
  Currency,
  CurrencyAmount,
  Ether,
  JSBI,
  Brettvm_Sepolia,
  NATIVE,
  Token,
  WNATIVE,
} from '../../sdk'
import React, { useCallback, useEffect, useState } from 'react'

import { AutoRow } from '../../components/Row'
import Container from '../../components/Container'
import Head from 'next/head'
import { ArrowDown, ArrowRight, Clock, Settings } from 'react-feather'
import Typography from '../../components/Typography'
import Web3Connect from '../../components/Web3Connect'
import { t } from '@lingui/macro'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useLingui } from '@lingui/react'
import { useMultichainCurrencyBalance, useTokenBalance } from '../../state/wallet/hooks'
import DoubleGlowShadow from '../../components/DoubleGlowShadow'
import BrettswapLogo from '../../components/BrettswapLogo'
import { BottomGrouping } from '../../features/swap/styleds'
import Button from '../../components/Button'
import DualChainCurrencyInputPanel from '../../components/DualChainCurrencyInputPanel'
import ChainSelect from '../../components/ChainSelect'
import { Chain, DEFAULT_CHAIN_FROM, DEFAULT_CHAIN_TO } from '../../sdk/entities/Chain'
import { useBridgeInfo } from '../../features/bridge/hooks'
import useSWR, { SWRResponse } from 'swr'
import { getAddress } from 'ethers/lib/utils'
import { formatNumber } from '../../functions'
import { SUPPORTED_NETWORKS } from '../../modals/ChainModal'
import { NETWORK_ICON, NETWORK_LABEL } from '../../constants/networks'
import { ethers } from 'ethers'
import { useAnyswapTokenContract, useTokenContract } from '../../hooks'
import Loader from '../../components/Loader'
import { getWeb3ReactContext, useWeb3React } from '@web3-react/core'
import { BridgeContextName } from '../../constants'
import { bridgeInjected } from '../../connectors'
import NavLink from '../../components/NavLink'
import { useTransactionAdder } from '../../state/bridgeTransactions/hooks'
import { useRouter } from 'next/router'
import Modal from '../../components/Modal'
import ModalHeader from '../../components/ModalHeader'

type AnyswapTokenInfo = {
  ID: string
  Name: string
  Symbol: string
  Decimals: number
  Description: string
  BaseFeePercent: number
  BigValueThreshold: number
  DepositAddress: string
  ContractAddress: string
  DcrmAddress: string
  DisableSwap: boolean
  IsDelegateContract: boolean
  MaximumSwap: number
  MaximumSwapFee: number
  MinimumSwap: number
  MinimumSwapFee: number
  PlusGasPricePercentage: number
  SwapFeeRate: number
}

type AnyswapResultPairInfo = {
  DestToken: AnyswapTokenInfo
  PairID: string
  SrcToken: AnyswapTokenInfo
  destChainID: string
  logoUrl: string
  name: string
  srcChainID: string
  symbol: string
}

type AvailableChainsInfo = {
  id: string
  token: AnyswapTokenInfo
  other: AnyswapTokenInfo
  logoUrl: string
  name: string
  symbol: string
  destChainID: string
}

export type AnyswapTokensMap = { [chainId: number]: { [contract: string]: AvailableChainsInfo } }

export default function Bridge() {
  const { i18n } = useLingui()

  const { account: activeAccount, chainId: activeChainId } = useActiveWeb3React()
  const { account, chainId, library, activate } = useWeb3React(BridgeContextName)
  const { push } = useRouter()

  const addTransaction = useTransactionAdder()

  const currentChainFrom = chainId &&
    SUPPORTED_NETWORKS[chainId] && { id: chainId, icon: NETWORK_ICON[chainId], name: NETWORK_LABEL[chainId] }

  useEffect(() => {
    activate(bridgeInjected)
    if (chainId) {
      if (chainId == chainTo.id) {
        setChainTo(chainFrom)
      }
      setChainFrom({ id: chainId, icon: NETWORK_ICON[chainId], name: NETWORK_LABEL[chainId] })
    }
  }, [activate, chainId, activeAccount, activeChainId])

  const [chainFrom, setChainFrom] = useState<Chain | null>(currentChainFrom || DEFAULT_CHAIN_FROM)

  const [chainTo, setChainTo] = useState<Chain | null>(
    chainId == ChainId.BRETTVM_SEPOLIA ? DEFAULT_CHAIN_FROM : DEFAULT_CHAIN_TO
  )

  const [tokenList, setTokenList] = useState<Currency[] | null>([])
  const [currency0, setCurrency0] = useState<Currency | null>(null)
  const [currencyAmount, setCurrencyAmount] = useState<string | null>('')
  const [tokenToBridge, setTokenToBridge] = useState<AvailableChainsInfo | null>(null)
  const currencyContract = useTokenContract(currency0?.isToken && currency0?.address, true)
  const anyswapCurrencyContract = useAnyswapTokenContract(
    currency0 && currency0.chainId == ChainId.BRETTVM_SEPOLIA && tokenToBridge.other.ContractAddress,
    true
  )
  const [pendingTx, setPendingTx] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const selectedCurrencyBalance = useMultichainCurrencyBalance(
    chainFrom?.id,
    account ?? undefined,
    currency0 ?? undefined
  )

  const { data: anyswapInfo, error }: SWRResponse<AnyswapTokensMap, Error> = useSWR(
    'https://bridgeapi.anyswap.exchange/v2/serverInfo/532',
    (url) =>
      fetch(url)
        .then((result) => result.json())
        .then((data) => {
          let result: AnyswapTokensMap = {}

          Object.keys(data || {}).map((key) => {
            const info: AnyswapResultPairInfo = data[key]

            let sourceContractAddress = info.SrcToken.ContractAddress
            if (!sourceContractAddress) {
              sourceContractAddress = WNATIVE[parseInt(info.srcChainID)].address
            }

            sourceContractAddress = sourceContractAddress.toLowerCase()

            let existingSource = result[parseInt(info.srcChainID)]
            if (!existingSource) {
              result[parseInt(info.srcChainID)] = {
                [sourceContractAddress]: {
                  destChainID: info.destChainID,
                  id: info.PairID,
                  logoUrl: info.logoUrl,
                  name: info.name,
                  symbol: info.symbol,
                  token: info.DestToken,
                  other: info.SrcToken,
                },
              }
            } else {
              result[parseInt(info.srcChainID)][sourceContractAddress] = {
                destChainID: info.destChainID,
                id: info.PairID,
                logoUrl: info.logoUrl,
                name: info.name,
                symbol: info.symbol,
                token: info.DestToken,
                other: info.SrcToken,
              }
            }

            let destContractAddress = info.DestToken.ContractAddress
            if (!destContractAddress) {
              destContractAddress = WNATIVE[parseInt(info.destChainID)].address
            }

            destContractAddress = destContractAddress.toLowerCase()

            let existingDestination = result[parseInt(info.destChainID)]
            if (!existingDestination) {
              result[parseInt(info.destChainID)] = {
                [destContractAddress]: {
                  destChainID: info.srcChainID,
                  id: info.PairID,
                  logoUrl: info.logoUrl,
                  name: info.name,
                  symbol: info.symbol,
                  token: info.SrcToken,
                  other: info.DestToken,
                },
              }
            } else {
              result[parseInt(info.destChainID)][destContractAddress] = {
                destChainID: info.srcChainID,
                id: info.PairID,
                logoUrl: info.logoUrl,
                name: info.name,
                symbol: info.symbol,
                token: info.SrcToken,
                other: info.DestToken,
              }
            }
          })

          return result
        })
  )

  useEffect(() => {
    let tokens: Currency[] = Object.keys((anyswapInfo && anyswapInfo[chainFrom.id]) || {})
      .filter((r) => anyswapInfo[chainFrom.id][r].destChainID == chainTo.id.toString())
      .map((r) => {
        const info: AvailableChainsInfo = anyswapInfo[chainFrom.id][r]
        if (r.toLowerCase() == WNATIVE[chainFrom.id].address.toLowerCase()) {
          if (chainFrom.id == ChainId.BRETTVM_SEPOLIA) {
            return Brettvm_Sepolia.onChain(chainFrom.id)
          }
          if (chainFrom.id == ChainId.BSC) {
            return Binance.onChain(chainFrom.id)
          }
          if (chainFrom.id == ChainId.MAINNET) {
            return Ether.onChain(chainFrom.id)
          }
        }
        return new Token(chainFrom.id, getAddress(r), info.token.Decimals, info.token.Symbol, info.name)
      })

    setTokenList(tokens)
    setCurrency0(null)
    setCurrencyAmount('')
  }, [chainFrom, anyswapInfo, chainTo.id])

  const handleChainFrom = useCallback(
    (chain: Chain) => {
      let changeTo = chainTo
      if (chainTo.id == chain.id) {
        changeTo = chainFrom
      }
      if (changeTo.id !== ChainId.BRETTVM_SEPOLIA && chain.id !== ChainId.BRETTVM_SEPOLIA) {
        setChainTo(DEFAULT_CHAIN_TO)
      } else {
        setChainTo(changeTo)
      }
      setChainFrom(chain)
    },
    [chainFrom, chainTo]
  )

  const handleChainTo = useCallback(
    (chain: Chain) => {
      let changeFrom = chainFrom
      if (chainFrom.id == chain.id) {
        changeFrom = chainTo
      }
      if (changeFrom.id !== ChainId.BRETTVM_SEPOLIA && chain.id !== ChainId.BRETTVM_SEPOLIA) {
        setChainFrom(DEFAULT_CHAIN_TO)
      } else {
        setChainFrom(changeFrom)
      }
      setChainTo(chain)
    },
    [chainFrom, chainTo]
  )

  const handleTypeInput = useCallback(
    (value: string) => {
      setCurrencyAmount(value)
    },
    [setCurrencyAmount]
  )

  const handleCurrencySelect = useCallback(
    (currency: Currency) => {
      setCurrency0(currency)
      handleTypeInput('')
      if (currency) {
        const tokenTo =
          anyswapInfo[chainFrom.id][
            currency.isToken ? currency?.address?.toLowerCase() : currency?.wrapped?.address?.toLowerCase()
          ]
        setTokenToBridge(tokenTo)
      }
    },
    [anyswapInfo, chainFrom.id, handleTypeInput]
  )

  const insufficientBalance = () => {
    if (currencyAmount && selectedCurrencyBalance) {
      try {
        const balance = parseFloat(selectedCurrencyBalance.toFixed(currency0.decimals))
        const amount = parseFloat(currencyAmount)
        return amount > balance
      } catch (ex) {
        return false
      }
    }
    return false
  }

  const aboveMin = () => {
    if (currencyAmount && tokenToBridge) {
      const amount = parseFloat(currencyAmount)
      const minAmount = parseFloat(tokenToBridge?.other?.MinimumSwap.toString())
      return amount >= minAmount
    }
    return false
  }

  const belowMax = () => {
    if (currencyAmount && tokenToBridge) {
      const amount = parseFloat(currencyAmount)
      const maxAmount = parseFloat(tokenToBridge?.other?.MaximumSwap.toString())
      return amount <= maxAmount
    }
    return false
  }

  const getAmountToReceive = () => {
    if (!tokenToBridge) return 0

    let fee = parseFloat(currencyAmount) * tokenToBridge?.other?.SwapFeeRate
    if (fee < tokenToBridge?.other?.MinimumSwapFee) {
      fee = tokenToBridge?.other?.MinimumSwapFee
    } else if (fee > tokenToBridge?.other?.MaximumSwapFee) {
      fee = tokenToBridge?.other?.MinimumSwapFee
    }

    return (parseFloat(currencyAmount) - fee).toFixed(6)
  }

  const buttonDisabled =
    (chainFrom && chainFrom.id !== chainId) ||
    !currency0 ||
    !currencyAmount ||
    currencyAmount == '' ||
    !aboveMin() ||
    !belowMax() ||
    insufficientBalance() ||
    pendingTx

  const buttonText =
    chainFrom && chainFrom.id !== chainId
      ? `Switch to ${chainFrom.name} Network`
      : !currency0
      ? `Select a Token`
      : !currencyAmount || currencyAmount == ''
      ? 'Enter an Amount'
      : !aboveMin()
      ? `Below Minimum Amount`
      : !belowMax()
      ? `Above Maximum Amount`
      : insufficientBalance()
      ? `Insufficient Balance`
      : pendingTx
      ? `Confirming Transaction`
      : `Bridge ${currency0?.symbol}`

  const bridgeToken = async () => {
    const token = tokenToBridge.other
    const depositAddress = currency0.chainId == ChainId.BRETTVM_SEPOLIA ? token.ContractAddress : token.DepositAddress

    const amountToBridge = ethers.utils.parseUnits(currencyAmount, token.Decimals)
    setPendingTx(true)

    try {
      if (currency0.chainId == ChainId.BRETTVM_SEPOLIA) {
        if (currency0.isNative) {
        } else if (currency0.isToken) {
          const fn = anyswapCurrencyContract?.interface?.getFunction('Swapout')
          const data = anyswapCurrencyContract.interface.encodeFunctionData(fn, [amountToBridge.toString(), account])
          const tx = await library.getSigner().sendTransaction({
            value: 0x0,
            from: account,
            to: currency0.address,
            data,
          })
          addTransaction(tx, {
            summary: `${i18n._(t`Bridge `)} ${tokenToBridge.symbol}`,
            destChainId: chainTo.id.toString(),
            srcChaindId: chainFrom.id.toString(),
            pairId: tokenToBridge.id,
          })
          push('/bridge/history')
        }
      } else {
        if (currency0.isNative) {
          const tx = await library.getSigner().sendTransaction({
            from: account,
            to: depositAddress,
            value: amountToBridge,
          })
          addTransaction(tx, {
            summary: `${i18n._(t`Bridge `)} ${tokenToBridge.symbol}`,
            destChainId: chainTo.id.toString(),
            srcChaindId: chainFrom.id.toString(),
            pairId: tokenToBridge.id,
          })
          push('/bridge/history')
        } else if (currency0.isToken) {
          const fn = currencyContract?.interface?.getFunction('transfer')
          const data = currencyContract.interface.encodeFunctionData(fn, [depositAddress, amountToBridge.toString()])
          const tx = await library.getSigner().sendTransaction({
            value: 0x0,
            from: account,
            to: currency0.address,
            data,
          })
          addTransaction(tx, {
            summary: `${i18n._(t`Bridge `)} ${tokenToBridge.symbol}`,
            destChainId: chainTo.id.toString(),
            srcChaindId: chainFrom.id.toString(),
            pairId: tokenToBridge.id,
          })
          push('/bridge/history')
        }
      }
    } catch (ex) {
    } finally {
      setPendingTx(false)
    }
  }
  return (
    <>
      <Modal isOpen={showConfirmation} onDismiss={() => setShowConfirmation(false)}>
        <div className="space-y-4">
          <ModalHeader title={i18n._(t`Bridge ${currency0?.symbol}`)} onClose={() => setShowConfirmation(false)} />
          <Typography variant="sm" className="font-medium">
            {i18n._(t`You are sending ${formatNumber(currencyAmount)} ${currency0?.symbol} from ${chainFrom?.name}`)}
          </Typography>
          <Typography variant="sm" className="font-medium">
            {i18n._(t`You will receive ${formatNumber(getAmountToReceive())} ${currency0?.symbol} on ${chainTo?.name}`)}
          </Typography>

          <Button color="gradient" size="lg" disabled={pendingTx} onClick={() => bridgeToken()}>
            <Typography variant="lg">
              {pendingTx ? (
                <div className={'p-2'}>
                  <AutoRow gap="6px" justify="center">
                    {buttonText} <Loader stroke="white" />
                  </AutoRow>
                </div>
              ) : (
                i18n._(t`Bridge ${currency0?.symbol}`)
              )}
            </Typography>
          </Button>
        </div>
      </Modal>

      <Head>
        <title>{i18n._(t`Bridge`)} | Brettswap</title>
        <meta key="description" name="description" content="Bridge" />
      </Head>

      <BrettswapLogo />

      <Container maxWidth="2xl" className="space-y-6">
        <DoubleGlowShadow opacity="0.6">
          <div className="p-4 space-y-4 rounded bg-dark-900" style={{ zIndex: 1 }}>
            <div className="flex items-center justify-center mb-4 space-x-3">
              <div className="grid grid-cols-3 rounded p-3px bg-dark-800 h-[46px]">
                <NavLink
                  activeClassName="font-bold border rounded text-high-emphesis border-dark-700 bg-dark-700"
                  exact
                  href={{
                    pathname: '/bridge',
                  }}
                >
                  <a className="flex items-center justify-center px-4 text-base font-medium text-center rounded-md text-secondary hover:text-high-emphesis ">
                    <Typography component="h1" variant="lg">
                      {i18n._(t`Bridge`)}
                    </Typography>
                  </a>
                </NavLink>
                <NavLink
                  activeClassName="font-bold border rounded text-high-emphesis border-dark-700 bg-dark-700"
                  exact
                  href={{
                    pathname: '/bridge/history',
                  }}
                >
                  <a className="flex items-center justify-center px-4 text-base font-medium text-center rounded-md text-secondary hover:text-high-emphesis">
                    <Typography component="h1" variant="lg">
                      {i18n._(t`History`)}
                    </Typography>
                  </a>
                </NavLink>
                <NavLink
                  activeClassName="font-bold border rounded text-high-emphesis border-dark-700 bg-dark-700"
                  exact
                  href={{
                    pathname: '/faucet',
                  }}
                >
                  <a className="flex items-center justify-center px-4 text-base font-medium text-center rounded-md text-secondary hover:text-high-emphesis">
                    <Typography component="h1" variant="lg">
                      {i18n._(t`Faucet`)}
                    </Typography>
                  </a>
                </NavLink>
              </div>
            </div>

            <div className="p-4 text-center">
              <div className="justify-between space-x-3 items-center">
                <Typography component="h3" variant="base">
                  {i18n._(t`Bridge tokens to and from the BrettVM Sepolia Network`)}
                </Typography>
              </div>
            </div>

            <div className="flex flex-row justify-between items-center text-center">
              <ChainSelect
                availableChains={Object.keys(anyswapInfo || {}).map((r) => parseInt(r))}
                label="From"
                chain={chainFrom}
                otherChain={chainTo}
                onChainSelect={(chain) => handleChainFrom(chain)}
                switchOnSelect={true}
              />
              <button className={'sm:m-6'}>
                <ArrowRight size="32" />
              </button>
              <ChainSelect
                availableChains={Object.keys(anyswapInfo || {}).map((r) => parseInt(r))}
                label="To"
                chain={chainTo}
                otherChain={chainFrom}
                onChainSelect={(chain) => handleChainTo(chain)}
                switchOnSelect={false}
              />
            </div>

            <DualChainCurrencyInputPanel
              label={i18n._(t`Token to bridge:`)}
              value={currencyAmount}
              currency={currency0}
              onUserInput={handleTypeInput}
              onMax={(amount) => handleTypeInput(amount)}
              onCurrencySelect={(currency) => {
                handleCurrencySelect(currency)
              }}
              chainFrom={chainFrom}
              chainTo={chainTo}
              tokenList={tokenList}
              chainList={anyswapInfo}
            />

            <BottomGrouping>
              {!account ? (
                <Web3Connect size="lg" color="gradient" className="w-full" />
              ) : (
                <Button
                  onClick={() => setShowConfirmation(true)}
                  color={buttonDisabled ? 'gray' : 'gradient'}
                  size="lg"
                  disabled={buttonDisabled}
                >
                  {pendingTx ? (
                    <div className={'p-2'}>
                      <AutoRow gap="6px" justify="center">
                        {buttonText} <Loader stroke="white" />
                      </AutoRow>
                    </div>
                  ) : (
                    buttonText
                  )}
                </Button>
              )}
            </BottomGrouping>

            {currency0 && (
              <div className={'p-2 sm:p-5 rounded bg-dark-800'}>
                {tokenToBridge?.other?.MinimumSwapFee > 0 && (
                  <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                    <div className="text-sm font-medium text-secondary">
                      Minimum Bridge Fee: {formatNumber(tokenToBridge?.other?.MinimumSwapFee)}{' '}
                      {tokenToBridge?.other?.Symbol}
                    </div>
                  </div>
                )}
                {tokenToBridge?.other?.MaximumSwapFee > 0 && (
                  <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                    <div className="text-sm font-medium text-secondary">
                      Maximum Bridge Fee: {formatNumber(tokenToBridge?.other?.MaximumSwapFee)}{' '}
                      {tokenToBridge?.other?.Symbol}
                    </div>
                  </div>
                )}
                <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                  <div className="text-sm font-medium text-secondary">
                    Minimum Bridge Amount: {formatNumber(tokenToBridge?.other?.MinimumSwap)}{' '}
                    {tokenToBridge?.other?.Symbol}
                  </div>
                </div>
                <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                  <div className="text-sm font-medium text-secondary">
                    Maximum Bridge Amount: {formatNumber(tokenToBridge?.other?.MaximumSwap)}{' '}
                    {tokenToBridge?.other?.Symbol}
                  </div>
                </div>
                <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                  <div className="text-sm font-medium text-secondary">
                    Fee: {formatNumber(tokenToBridge?.other?.SwapFeeRate * 100)} %
                  </div>
                </div>
                <div className="flex flex-col justify-between space-y-3 sm:space-y-0 sm:flex-row">
                  <div className="text-sm font-medium text-secondary">
                    Amounts greater than {formatNumber(tokenToBridge?.other?.BigValueThreshold)}{' '}
                    {tokenToBridge?.other?.Symbol} could take up to 12 hours.
                  </div>
                </div>
              </div>
            )}

            <AutoRow
              style={{ justifyItems: 'center', backgroundColor: '', padding: '12px 0px', borderRadius: '12px' }}
              justify={'center'}
              gap={'0 3px'}
            >
              {i18n._(t`Powered by Anyswap Network`)}
            </AutoRow>
          </div>
        </DoubleGlowShadow>
      </Container>
    </>
  )
}
