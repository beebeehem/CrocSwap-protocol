/* Creates the sidecar proxy contracts and periphery contracts. */

import { initProvider, validateDeploy } from '../libs/chain';
import { AbiCoder } from '@ethersproject/abi';

async function validate() {
    let { addrs, provider: provider } = initProvider()

    validateDeploy(addrs.cold, "ColdPath", provider)
    validateDeploy(addrs.hot, "HotPath", provider)
    validateDeploy(addrs.long, "LongPath", provider)
    validateDeploy(addrs.long, "MicroPaths", provider)
    validateDeploy(addrs.long, "WarmPath", provider)
    validateDeploy(addrs.knockout, "KnockoutLiqPath", provider)
    validateDeploy(addrs.koCross, "KnockoutFlagPath", provider)
    validateDeploy(addrs.dex, "CrocSwapDex", provider)
    validateDeploy(addrs.policy, "CrocPolicy", provider, addrs.dex)
    validateDeploy(addrs.query, "CrocQuery", provider, addrs.dex)
    validateDeploy(addrs.impact, "CrocImpact", provider, addrs.dex)    
}

validate()
