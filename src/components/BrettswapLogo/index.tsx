import React from 'react'
import Image from '../Image'

/**
 * Renders an image by sequentially trying a list of URIs, and then eventually a fallback triangle alert
 */
const BrettswapLogo = () => {
  return (
    <>
      <div className="mt-4 mb-4 sm:hidden"></div>
      <div className="flex justify items-center mt-8 mb-12 hidden sm:block" style={{ minHeight: 40 }}>
        <Image src="/logo.png" alt="Brettswap" width={394} height={102} />
      </div>
    </>
  )
}

export default BrettswapLogo
