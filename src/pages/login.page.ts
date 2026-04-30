import basePage from './page'
import { selector } from '../lib/selectors'
import { click, setValue } from '../lib/wdio-utils'

class LoginPage extends basePage {
    get _inputUsername(): string {
        return selector('username').Id
    }
    get _inputPassword(): string {
        return selector('password').Id
    }
    get _btnSubmit(): string {
        return 'button[type="submit"]'
    }

    async login(username: string, password: string): Promise<void> {
        await setValue($(this._inputUsername), username)
        await setValue($(this._inputPassword), password)
        await click($(this._btnSubmit))
    }

    async open(): Promise<void> {
        return super.open('login')
    }
}

export default LoginPage
