// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import { MD5 } from "./utils";

Cypress.Commands.add("getEmails", (email) => {
  cy.log(`Cypress.env("RapidAPI"): ${Cypress.env("RapidAPI")}`);

  const options = {
    method: "GET",
    url: `https://privatix-temp-mail-v1.p.rapidapi.com/request/mail/id/${MD5(
      email
    )}/`,
    headers: {
      "X-RapidAPI-Key": Cypress.env("RapidAPI"),
      "X-RapidAPI-Host": "privatix-temp-mail-v1.p.rapidapi.com",
    },
  };
  return cy.request(options).its("body");
});
