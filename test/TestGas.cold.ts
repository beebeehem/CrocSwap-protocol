import { TestPool, makeTokenPool, Token } from './FacadePool'
import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from 'hardhat';
import { toSqrtPrice, fromSqrtPrice, maxSqrtPrice, minSqrtPrice } from './FixedPoint';
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { MockERC20 } from '../typechain/MockERC20';
import { ContractTransaction, BigNumber } from 'ethers';

chai.use(solidity);

// If set to true, every test will fail and therefore print the actual gas spend. 
const METRIC_PROFILE = false

describe('Gas Benchmarks Coldpath', () => {
    let test: TestPool
    let initTx: Promise<ContractTransaction>
    const feeRate = 225 * 100

    beforeEach("deploy",  async () => {
       test = await makeTokenPool()
       await test.fundTokens()

       initTx = test.initPool(feeRate, 0, 1, 1.0)
       await initTx

       test.useHotPath = false
    })

    async function gasUsed (tx: Promise<ContractTransaction>): Promise<BigNumber> {
        return tx
            .then(t => t.wait())
            .then(t => t.gasUsed)
    }

    async function expectGas (tx: Promise<ContractTransaction>, limit: number) {
        let gas = await gasUsed(tx)
        let comp = METRIC_PROFILE ? 0 : limit
        expect(gas).to.be.lt(comp)
    }

    it("create pool", async() => {
        await expectGas(initTx, 92000)
    })

    it("mint in virgin pool", async() => {
        await expectGas(test.testMint(-100, 100, 100), 349000)
    })

    it("mint increase liq", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMint(-100, 100, 10000), 156000)
    })

    it("mint pre-init ticks", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMintOther(-100, 100, 10000), 172000)
    })

    it("mint one fresh init", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMintOther(-100, 200, 10000), 198000)
    })

    it("mint fresh ticks", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMintOther(-200, 200, 10000), 224000)
    })

    it("mint below price", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMintOther(-300, -200, 10000), 213000)
    })

    it("mint above price", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testMintOther(200, 300, 100), 214000)
    })

    it("burn partial", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testBurn(-100, 100, 50), 139000)
    })

    it("burn partial level left", async() => {
        await test.testMint(-100, 100, 100)
        await test.testMintOther(-100, 100, 100)
        await expectGas(test.testBurn(-100, 100, 50), 139000)
    })

    it("burn full", async() => {
        await test.testMint(-100, 100, 100)
        await expectGas(test.testBurn(-100, 100, 100), 132000)
    })

    it("burn full level left", async() => {
        await test.testMint(-100, 100, 100)
        await test.testMintOther(-100, 100, 100)
        await expectGas(test.testBurn(-100, 100, 100), 134000)
    })

    it("burn outside", async() => {
        await test.testMint(-200, -100, 100)
        await expectGas(test.testBurn(-200, -100, 100), 107000)
    })

    it("burn outside left", async() => {
        await test.testMint(-200, -100, 100)
        await test.testMintOther(-200, -100, 100)
        await expectGas(test.testBurn(-200, -100, 100), 113000)
    })

    it("burn liq rewards", async() => {
        await test.testMint(-100, 100, 100000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testBurn(-100, 100, 100), 139000)
    })

    it("burn liq level left", async() => {
        await test.testMint(-100, 100, 100)
        await test.testMintOther(-100, 100, 100)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testBurn(-100, 100, 100), 139000)
    })

    it("burn flipped", async() => {
        await test.testMint(-100, 100, 100)
        await test.testSwapOther(true, true, 1000000, toSqrtPrice(1.1))
        await expectGas(test.testBurn(-100, 100, 100), 133000)
    })

    it("burn flipped level left", async() => {
        await test.testMint(-100, 100, 100)
        await test.testMintOther(-100, 100, 1000)
        await test.testSwapOther(true, true, 1000000, toSqrtPrice(1.1))
        await expectGas(test.testBurn(-100, 100, 100), 135000)
    })

    it("swap no pre-warm", async() => {
        await test.testMint(-100, 100, 10000)
        await expectGas(test.testSwapOther(true, true, 1000, toSqrtPrice(1.1)), 166000)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap small", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testSwapOther(true, true, 1000, toSqrtPrice(1.1)), 148000)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap tick w/o cross", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.0005))
        await expectGas(test.testSwapOther(true, true, 10000000, toSqrtPrice(1.005)), 148000)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap bitmap w/o cross", async() => {
        await test.testMint(-500, 500, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testSwapOther(true, true, 10000000, toSqrtPrice(1.04)), 169000)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap cross tick", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testMint(-500, 500, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testSwapOther(true, true, 1000000, toSqrtPrice(1.04)), 196000)
        expect(await test.liquidity()).to.be.lt(10100*1024)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap cross two tick", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testMint(-200, 200, 10000)
        await test.testMint(-500, 500, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))

        await expectGas(test.testSwapOther(true, true, 2000000, toSqrtPrice(1.021)), 202000)
        expect(await test.liquidity()).to.be.lt(10100*1024)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap cross two tick and bitmap", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testMint(-200, 200, 10000)
        await test.testMint(-500, 500, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))

        await expectGas(test.testSwapOther(true, true, 2000000, toSqrtPrice(1.04)), 223000)
        expect(await test.liquidity()).to.be.lt(10100*1024)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap cross bitmap between two tick ", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testMint(-200, 300, 10000)
        await test.testMint(-500, 500, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))

        await expectGas(test.testSwapOther(true, true, 2000000, toSqrtPrice(1.04)), 223000)
        expect(await test.liquidity()).to.be.lt(10100*1024)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("swap cross many ticks", async() => {
        await test.testMint(-100, 100, 10000)
        await test.testMint(-200, 200, 1000)
        await test.testMint(-200, 210, 1000)
        await test.testMint(-200, 220, 1000)
        await test.testMint(-200, 250, 1000)
        await test.testMint(-200, 280, 1000)
        await test.testMint(-200, 300, 1000)
        await test.testMint(-500, 500, 1000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))

        await expectGas(test.testSwapOther(true, true, 2000000, toSqrtPrice(1.04)), 358000)
        expect(await test.liquidity()).to.be.lt(1010*1024)
        expect(await test.liquidity()).to.be.gt(1000*1024)
    })

    it("swap cross many bitmap", async() => {
        await test.testMint(-10000, 100000, 10000)
        await test.testSwapOther(true, true, 100000000, toSqrtPrice(5.0))

        await expectGas(test.testSwapOther(true, true, 2000000, toSqrtPrice(1050.0)), 179000)
        expect(fromSqrtPrice(await test.price())).gt(2.4)
    })

    it("swap surplus", async() => {
        let sender = await (await test.trader).getAddress() 
        await (await test.dex).collect(sender, -100000, (await test.base).address) 
        await (await test.dex).collect(sender, -250000, (await test.quote).address) 

        await test.testMint(-1000, 1000, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testSwapSurplus(true, true, 1000, toSqrtPrice(1.1)), 148000)
        expect(await test.liquidity()).to.be.gt(10000*1024)
    })

    it("mint surplus", async() => {
        let sender = await (await test.trader).getAddress() 
        await (await test.dex).collect(sender, -100000, (await test.base).address) 
        await (await test.dex).collect(sender, -250000, (await test.quote).address) 

        await test.testMintOther(-1000, 1000, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testMint(-1000, 1000, 5000, true), 173000)
    })

    it("burn surplus", async() => {
        let sender = await (await test.trader).getAddress() 
        await (await test.dex).collect(sender, -100000, (await test.base).address) 
        await (await test.dex).collect(sender, -250000, (await test.quote).address) 

        await test.testMintOther(-1000, 1000, 10000)
        await test.testMint(-1000, 1000, 10000)
        await test.testSwapOther(true, true, 1000, toSqrtPrice(1.1))
        await expectGas(test.testBurn(-1000, 1000, 5000, true), 141000)
    })

})