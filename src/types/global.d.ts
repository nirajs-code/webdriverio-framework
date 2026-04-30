import type { TestDataService } from '../services/TestDataService'

declare global {
    var TestData: TestDataService
}
