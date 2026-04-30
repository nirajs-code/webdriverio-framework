import * as path from 'path'

export const PAGE_LOAD_TIMEOUT = 30_000
export const LIGHTHOUSE_REPORT_PATH = path.resolve(process.cwd(), '.tmp', 'lighthouse-report.html')
export const PERF_RESULTS_FOLDER = path.resolve(process.cwd(), '.tmp', 'perf-results')
