@pageperf @lighthouse @smoke
Feature: Page performance

  Background:
    Given performance audits are enabled

  @smoke
  Scenario: Home page meets core web vitals standards
    When I navigate to "https://the-internet.herokuapp.com" with performance tracking
    Then the page should meet core web vitals standards
    And a lighthouse report should be saved
    And performance audits are disabled

  @regression
  Scenario: Home page passes performance score threshold
    When I navigate to "https://the-internet.herokuapp.com" with performance tracking
    Then the performance score should be above 80
    And performance audits are disabled

  @regression
  Scenario: Home page meets strict performance budget
    When I navigate to "https://the-internet.herokuapp.com" with performance tracking
    Then the page should meet the performance budget:
      | largestContentfulPaint | 4000 |
      | firstContentfulPaint   | 3000 |
      | totalBlockingTime      | 600  |
      | cumulativeLayoutShift  | 0.25 |
    And a lighthouse report should be saved
    And performance audits are disabled

  @mobile @regression
  Scenario: Home page is performant on mobile
    Given performance audits are enabled for mobile
    When I navigate to "https://the-internet.herokuapp.com" with performance tracking
    Then the LCP should be below 6000 milliseconds
    Then the FCP should be below 4000 milliseconds
    And performance audits are disabled
