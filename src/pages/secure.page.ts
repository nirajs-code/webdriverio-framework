import { $ } from '@wdio/globals'

import basePage from './page'

class SecurePage extends basePage {
    get flashAlert() {
        return $('#flash')
    }
}

export default SecurePage
