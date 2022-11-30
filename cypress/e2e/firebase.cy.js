import { MD5 } from "../support/utils";
let email = null;

describe("Firebase login", () => {
  beforeEach(() => {
    cy.readFile("email.json").then((data) => {
      email = data.email;
    });
  });
  it("can't log in", () => {
    // HACK doing this in the first run because before hook gets called multiple times when visiting different TLDs
    const emailPrefix = `test-create-account${+new Date()}`;
    email = `${emailPrefix}@maxric.com`;
    cy.log(`email: `, email);

    cy.writeFile("email.json", { email });
    cy.visit("http://localhost:3000/#/login");
    cy.get("#ui-sign-in-email-input").type(`hisingh1@gmail.com`);
    cy.contains("Next").click();
    cy.get("#ui-sign-in-password-input").type("random password");
    cy.contains("Sign In").click();
  });
  it("can create account and log in", () => {
    // Create account
    cy.visit("http://localhost:3000/#/login");

    const password = "testpassword1";
    cy.get("#ui-sign-in-email-input").type(email);
    cy.contains("Next").click();
    cy.get("#ui-sign-in-name-input").type("Test User");
    cy.get("#ui-sign-in-new-password-input").type(password);
    cy.contains("Save").click();
    // Login
    cy.visit("http://localhost:3000/#/logout");
    cy.url().should("not.include", "logout");
    cy.visit("http://localhost:3000/#/login");
    cy.get("#ui-sign-in-email-input").type(email);
    cy.contains("Next").click();
    cy.get("#ui-sign-in-password-input").type(password);
    cy.contains("Sign In").click();
    cy.url().should("include", "pay");
    // Change password
    cy.visit("http://localhost:3000/#/logout");
    cy.url().should("not.include", "logout");
    cy.visit("http://localhost:3000/#/login");
    cy.get("#ui-sign-in-email-input").type(email);
    cy.contains("Next").click();
    cy.contains("Trouble signing in?").click();
    cy.contains("Send").click();
    cy.contains("Check your email").should("be.visible");
    cy.log(`MD5(email): `, MD5(email));
  });
  // eslint-disable-next-line
  it("can reset password", () => {
    // eslint-disable-next-line
    cy.wait(10000);
    return cy.getEmails(email).then((emails) => {
      const url = emails[0].mail_text.match(/https.*=en/)[0];
      cy.visit(url);
      cy.get(".firebaseui-id-new-password").type("testpassword2");
      cy.contains("Save").click();
    });
  });
  it("cant log in after password reset", () => {
    cy.visit("http://localhost:3000/#/login");
    cy.get("#ui-sign-in-email-input").type(email);
    cy.contains("Next").click();
    cy.get("#ui-sign-in-password-input").type("testpassword2");
    cy.contains("Sign In").click();
    cy.url().should("include", "pay");
  });
});
