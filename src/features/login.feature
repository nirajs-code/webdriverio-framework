Feature: The Internet Guinea Pig Website

  @smoke @login
  Scenario Outline: As a user, I can log into the secure area
    Given I am on the login page
    When I login with <userType>
    Then I should see a flash message saying <message>

    Examples:
      | userType  | message                        |
      | validUser | You logged into a secure area! |

  @smoke @login @invalidUser
  Scenario: As a user, I can log into the secure area with an invalid user
    Given I am on the login page
    When I login with invalidUser
    Then I should see a flash message saying Your username is invalid!
