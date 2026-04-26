import { $ } from '@wdio/globals'
import Page from './page'

class LoginPage extends Page {
    get inputUsername() {
        return $('#username')
    }

    get inputPassword() {
        return $('#password')
    }

    get btnSubmit() {
        return $('button[type="submit"]')
    }

    async login(username: string, password: string): Promise<void> {
        await this.inputUsername.setValue(username)
        await this.inputPassword.setValue(password)
        await this.btnSubmit.click()
    }

    async open(): Promise<void> {
        return super.open('login')
    }
}

export default new LoginPage()
