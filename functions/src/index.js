import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as paypal from "paypal-rest-sdk";

const cors = require("cors")({
  origin: true
});

admin.initializeApp(functions.config().firebase);

const PLANS = {
  oneIndividual15: { price: 15.0, time: 31536000000 },
  fiveIndividual50: { price: 50.0, time: 157680000000 },
  lifetimeIndividual80: { price: 80.0, time: 3153600000000 }
};

export const process = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    const config = functions.config();
    const { type, orderID, uid } = JSON.parse(req.body);
    console.log(orderID);

    var env = new paypal.core.SandboxEnvironment(
      "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv",
      "EIp7U4Y4Z9RU5moIZrOxW_KaXgPCC94x2fMlXmqHOs9Hp7u-kKjpx5iPv8tULuRXZ7RwJBr3rtXGPo0a"
    );
    if (config.paypal && config.paypal.mode === "live") {
      env = new paypal.core.LiveEnvironment(config.paypal.client_id, config.paypal.client_secret);
    }
    let client = new paypal.core.PayPalHttpClient(env);
    let getOrder = new paypal.v1.orders.OrdersGetRequest(orderID);
    client
      .execute(getOrder)
      .then(resp => {
        console.info(
          resp.statusCode < 400,
          resp.result.status === "COMPLETED",
          parseFloat(resp.result.gross_total_amount.value),
          PLANS[type].price
        );

        if (
          resp.statusCode < 400 &&
          resp.result.status === "COMPLETED" &&
          parseFloat(resp.result.gross_total_amount.value) === PLANS[type].price
        ) {
          const expiresOn = +new Date(+new Date(resp.result.create_time) + PLANS[type].time);
          const ref = admin.database().ref("paid/" + uid + "/");
          console.info({
            paidOn: +new Date(),
            expiresOn,
            orderID,
            payer: resp.result.payer,
            gross_total_amount: resp.result.gross_total_amount
          });
          ref.set({
            paidOn: +new Date(),
            expiresOn,
            orderID,
            payer: resp.result.payer,
            gross_total_amount: resp.result.gross_total_amount
          });
          return res.status(200).send();
        } else {
          return res.status(500).send("Something broke!");
        }
      })
      .catch(error => {
        console.log(error);
        return res.status(500).send("Something broke!");
        // res.redirect(`${req.protocol}://${req.get("host")}/pay`);
      });
  });
});

// This is a Hello World function which writes to the database.
export const confirmBeta = functions.database.ref("/confirmBeta/{uid}").onWrite(async event => {
  const userInfo = event.data.val();
  if (userInfo) {
    console.log(userInfo);
    const tokens = {};
    // Get list of admins
    const admins = Object.keys(
      (await admin
        .database()
        .ref("/admin")
        .once("value")).val() || {}
    );
    console.log(admins);

    // For each admin, get tokens
    const potentialUsersTokens = await Promise.all(
      admins.map(uid =>
        admin
          .database()
          .ref(`/messages/${uid}/tokens`)
          .once("value")
      )
    );
    potentialUsersTokens.forEach(usersTokens => {
      if (usersTokens.val()) {
        Object.keys(usersTokens.val()).forEach((token, index) => {
          // Associate the token with the uid in case you need to remove a bad token
          tokens[token] = admins[index];
          console.log(`Found token ${token} for ${admins[index]}`);
        });
      }
    });
    // For each token send message
    const payload = {
      notification: {
        title: "New user awaiting access!",
        body: `${userInfo.name} is waiting to joing beta.`,
        clickAction: "https://sing.withamma.com/#/admin"
      }
    };
    const tokensList = Object.keys(tokens);
    console.log("tokensList", tokensList);
    return admin
      .messaging()
      .sendToDevice(tokensList, payload)
      .then(response => {
        // For each message check if there was an error.
        const tokensToRemove = [];
        response.results.forEach((result, index) => {
          const { error } = result;
          if (error) {
            console.error("Failure sending notification to", tokensList[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (
              error.code === "messaging/invalid-registration-token" ||
              error.code === "messaging/registration-token-not-registered"
            ) {
              tokensToRemove.push(
                admin
                  .database()
                  .ref(`/messages/${tokens[tokensList[index]]}/tokens/${tokensList[index]}`)
                  .remove()
              );
            }
          }
        });
        return Promise.all(tokensToRemove);
      });
  }
});
