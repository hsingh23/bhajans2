import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as paypal from "paypal-rest-sdk";
const PLANS = [
  {
    value: "oneIndividual10",
    label: "1 Year - $9.99",
    price: 9.99,
    time: 31536000000
  },
  {
    value: "tenIndividual50",
    label: "10 Year - 49.99",
    price: 49.99,
    time: 315360000000,
    isBest: true
  },
  {
    value: "fiveIndividual40",
    label: "5 Year - $39.99",
    price: 39.99,
    time: 157680000000
  }
];
const cors = require("cors")({
  origin: true
});

admin.initializeApp(functions.config().firebase);

export const process = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    const config = functions.config();
    const { mode, type, orderID, uid } = JSON.parse(req.body);
    console.log("LOGGING ", mode, type, orderID, uid);
    var env = new paypal.core.SandboxEnvironment(
      "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv",
      "EIp7U4Y4Z9RU5moIZrOxW_KaXgPCC94x2fMlXmqHOs9Hp7u-kKjpx5iPv8tULuRXZ7RwJBr3rtXGPo0a"
    );

    if (
      mode === "live" &&
      config.paypal &&
      config.paypal.client_id &&
      config.paypal.client_secret
    ) {
      env = new paypal.core.LiveEnvironment(
        config.paypal.client_id,
        config.paypal.client_secret
      );
    }
    let client = new paypal.core.PayPalHttpClient(env);
    let getOrder = new paypal.v1.orders.OrdersGetRequest(orderID);
    client
      .execute(getOrder)
      .then(
        ({
          statusCode,
          result: { status, gross_total_amount, create_time, payer }
        }) => {
          console.log(
            "Paypal LOGGING ",
            mode,
            type,
            orderID,
            uid,
            status,
            gross_total_amount,
            create_time,
            payer
          );
          const plan = PLANS.find(x => x.value === type);
          console.log(plan, type, PLANS);

          if (
            statusCode < 400 &&
            status === "COMPLETED" &&
            parseFloat(gross_total_amount.value) === plan.price
          ) {
            const expiresOn = +new Date(+new Date(create_time) + plan.time);
            const rootRef = admin.database().ref();
            const paidOn = +new Date();
            rootRef.child("paid/" + uid + "/").set({
              paidOn,
              expiresOn,
              orderID,
              payer,
              gross_total_amount,
              mode
            });
            rootRef.child("transactions/").push({
              uid,
              paidOn,
              expiresOn,
              orderID,
              payer,
              gross_total_amount,
              mode
            });
            return res.json({ expiresOn, payer: payer });
          } else {
            return res.status(400).json({
              type: "invalid_request_error",
              message: "Order invalid",
              extra: { orderID, uid, type, mode }
            });
          }
        }
      )
      .catch(error => {
        console.error(error, mode, type, orderID, uid);
        return res.status(500).json({
          type: "api_error",
          message: error,
          extra: { error, orderID, uid, type, mode }
        });
      });
  });
});

// This is a Hello World function which writes to the database.
export const paid = functions.database
  .ref("/paid/{uid}")
  .onWrite(async event => {
    const { payer, gross_total_amount } = event.after.val();
    if (gross_total_amount) {
      const tokens = {};
      const rootRef = admin.database().ref();
      // Get list of admins
      const admins = Object.keys(
        (await rootRef.child("/admin").once("value")).val() || {}
      );

      // For each admin, get tokens
      await Promise.all(
        admins.map(async uid => {
          const toks = await admin
            .database()
            .ref(`/messages/${uid}/tokens`)
            .once("value");
          const toks2 = Object.keys(toks.val() || {});
          toks2.forEach(token => {
            tokens[token] = uid;
          });
          return toks2;
        })
      );
      // For each token send message
      const payload = {
        notification: {
          title: `${payer.name.given_name} signed up!`,
          body: `${payer.name.given_name} ${payer.name
            .surname} paid ${gross_total_amount.value} - ${payer.email_address}`
        }
      };
      const tokensList = Object.keys(tokens);
      return admin
        .messaging()
        .sendToDevice(tokensList, payload)
        .then(response => {
          // For each message check if there was an error.
          const tokensToRemove = [];
          response.results.forEach((result, index) => {
            const { error } = result;
            const token = tokensList[index];
            if (error) {
              // Cleanup the tokens who are not registered anymore.
              if (
                error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered"
              ) {
                tokensToRemove.push(
                  admin
                    .database()
                    .ref(`/messages/${tokens[token]}/tokens/${token}`)
                    .remove()
                );
              }
            }
          });
          return Promise.all(tokensToRemove);
        });
    }
  });
