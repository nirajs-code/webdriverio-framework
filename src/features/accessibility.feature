@accessibility @smoke
Feature: Accessibility compliance

  Background:
    Given I am on the login page

  @smoke
  Scenario: Login page has no accessibility violations
    Then the page should have no accessibility violations

  @smoke
  Scenario: Login page conforms to WCAG 2.1 AA
    Then the page should conform to "WCAG 2.1 AA"

  @regression
  Scenario: Login page has no serious or critical violations
    Then the page should have no "serious" or above accessibility violations

  @regression
  Scenario: Login page form region is fully accessible
    Then the "form" region should have no accessibility violations

  @regression
  Scenario: Login page conforms to WCAG 2.2 AA
    Then the page should conform to "WCAG 2.2 AA"

  @regression
  Scenario: Login page passes best practice checks
    Then the page should have no "best-practice" violations

  @baseline
  Scenario: Audit login page and report violations without failing
    Then I audit the page for accessibility violations

  @regression
  Scenario: All major page regions are individually accessible
    Then each region should have no accessibility violations:
      | header |
      | main   |
      | footer |
