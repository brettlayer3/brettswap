const Web3 = require('web3')
const { default: axios } = require('axios')
import IUniswapV2PairABI from '../../constants/abis/uniswap-v2-pair.json'
const NETWORK_URL = 'https://rpc-sepolia.brettvm.com'
const web3 = new Web3(NETWORK_URL)

export default async function handler(req, res) {
  let brettUSDCContract = new web3.eth.Contract(IUniswapV2PairABI, '0xe537f70a8b62204832B8Ba91940B77d3f79AEb81')
  const brettUSDCReserves = await brettUSDCContract.methods.getReserves().call()

  const brettUSDCPrice = (Number(brettUSDCReserves.reserve1) / Number(brettUSDCReserves.reserve0) ) * 1e12

  let bswapBrettContract = new web3.eth.Contract(IUniswapV2PairABI, '0x7eDA899b3522683636746a2f3a7814e6fFca75e1')
  const bswapBrettReserves = await bswapBrettContract.methods.getReserves().call()

  const bswapBrettPrice = Number(bswapBrettReserves.reserve1) / Number(bswapBrettReserves.reserve0)

  let ribBrettContract = new web3.eth.Contract(IUniswapV2PairABI, '0x0acDB54E610dAbC82b8FA454b21AD425ae460DF9')
  const ribBrettReserves = await ribBrettContract.methods.getReserves().call()

  const ribBrettPrice = Number(ribBrettReserves.reserve0) / Number(ribBrettReserves.reserve1)

  let ret = {}
  ret['brett'] = brettUSDCPrice
  ret['bswap'] = bswapBrettPrice * brettUSDCPrice
  ret['rib'] = ribBrettPrice * brettUSDCPrice
  ret['usdc'] = 1

  res.status(200).json(ret)
}
