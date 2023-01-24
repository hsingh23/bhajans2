import { newUserResetPasswordEmail } from "./mail";
const fetch = require("node-fetch");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

const amritabooks_secret = functions.config().config.amritabooks_secret;
const mailjet_auth_header = functions.config().config.mailjet_auth_header;
const amritabooks_secret_debug = functions.config().config
  .amritabooks_secret_debug;
const PLANS = [
  {
    value: "oneIndividual10",
    label: "1 Year - $9.99",
    price: 9.99,
    time: 31536000000,
  },
  {
    value: "tenIndividual50",
    label: "10 Year - 49.99",
    price: 49.99,
    time: 315360000000,
    isBest: true,
  },
  {
    value: "fiveIndividual40",
    label: "5 Year - $39.99",
    price: 39.99,
    time: 157680000000,
  },
];
const TIMES = {
  1: 31536000000,
  5: 157680000000,
  10: 315360000000,
};
const cors = require("cors")({
  origin: true,
});
const generateRandomString = (myLength) => {
  const chars =
    "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";
  const randomArray = Array.from(
    { length: myLength },
    (v, k) => chars[Math.floor(Math.random() * chars.length)]
  );

  const randomString = randomArray.join("");
  return randomString;
};

admin.initializeApp(functions.config().firebase);

// gcloud functions add-iam-policy-binding "getUserByEmail" --member='allUsers'  --role='roles/cloudfunctions.invoker'
export const getUserByEmail = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const rootRef = admin.database().ref();
    const isAdmin =
      (
        await rootRef.child(`/admin/${context.auth.uid}`).once("value")
      ).val() === "1";
    if (isAdmin) {
      try {
        const { uid, email, displayName } = await admin
          .auth()
          .getUserByEmail(data.email)
          .then((x) => x.toJSON());
        const { paidOn, expiresOn } =
          (await rootRef.child(`/paid/${uid}`).once("value")).val() || {};
        return { uid, email, displayName, paidOn, expiresOn };
      } catch (e) {
        console.log(context.auth.uid, data.email, e);
      }
    }
    return {};
  });

export const amritabooks = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Max-Age", "7200");
    return res.status(204).send("");
  } else {
    try {
      const rawBody = req.rawBody.toString();
      const body = JSON.parse(rawBody);
      const hash = crypto
        .createHmac("SHA256", amritabooks_secret)
        .update(rawBody)
        .digest("base64");
      const expected = req.headers["x-wc-webhook-signature"];
      console.log(hash, expected, hash === expected);
      if (hash !== expected && amritabooks_secret_debug !== "1") {
        return res.status(401).send("");
      }
      const {
        status,
        billing,
        order_key,
        needs_payment,
        date_paid_gmt,
        line_items,
      } = body;
      if (
        status === "processing" &&
        needs_payment === false &&
        !!billing?.email
      ) {
        var time = null;
        line_items.forEach(({ sku, subtotal }) => {
          if (sku === "SingWithAmma-1year") {
            time = TIMES[1];
          }
        });
        if (time) {
          const email = billing.email;
          const expiresOn = +new Date(+new Date() + time);

          const password = generateRandomString(10);
          var uid = null;
          try {
            const user = await admin.auth().getUserByEmail(email);
            uid = user.uid;
          } catch (error) {
            // user not found, so create, reset password and send welcome email
            try {
              const user = await admin.auth().createUser({ email, password });
              const resetLink = await admin
                .auth()
                .generatePasswordResetLink(email);
              await newUserResetPasswordEmail({
                email,
                password,
                resetLink,
                validUntil: new Date(expiresOn).toLocaleDateString(),
                apiKey: mailjet_auth_header,
              });

              uid = user.uid;
            } catch (error) {
              console.log(`unable to create user ${email} ${error}`);
              return res.send(500);
            }
          }
          const rootRef = admin.database().ref();
          const paidOn = +new Date();
          rootRef.child("paid/" + uid + "/").set({
            expiresOn,
            // gross_total_amount: {
            //   currency: "INR",
            //   value: plan.price,
            // },
            mode: "live",
            manual: false,
            orderID: order_key,
            paidOn,
            payer: {
              payer_id: email,
            },
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.status(200).send({ message: "done" });
});

export const manuallyAddUser = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    const { type, email } = JSON.parse(req.body);
    console.log("LOGGING ", email);
    const user = await admin.auth().getUserByEmail(email);
    const plan = PLANS.find((x) => x.value === type);
    const expiresOn = +new Date(+new Date() + plan.time);
    const rootRef = admin.database().ref();
    const paidOn = +new Date();
    rootRef.child("paid/" + user.uid + "/").set({
      expiresOn,
      gross_total_amount: {
        currency: "USD",
        value: plan.price,
      },
      mode: "live",
      manual: true,
      orderID: "admin",
      paidOn,
      payer: {
        payer_id: "admin",
      },
    });
    rootRef.child("transactions/").push({
      uid: user.uid,
      expiresOn,
      gross_total_amount: {
        currency: "USD",
        value: plan.price,
      },
      mode: "live",
      manual: true,
      orderID: "admin",
      paidOn,
      payer: {
        payer_id: "admin",
      },
    });
    res.status(200).send({ message: "done" });
  });
});

// export const getUserByEmail = functions.https.onRequest(async (req, res) => {
//   return cors(req, res, async () => {
//     // const config = functions.config();
//     const { email } = JSON.parse(req.body);
//     console.log("LOGGING ", email);
//     const user = await admin.auth.getUserByEmail(email).then(x => x.toJSON());
//     admin.database().ref(``)
//   });
// });

// export const process = functions.https.onRequest(async (req, res) => {
//   return cors(req, res, async () => {
//     const config = functions.config();
//     const { mode, type, orderID, uid } = JSON.parse(req.body);
//     console.log("LOGGING ", mode, type, orderID, uid);
//     var env = new paypal.core.SandboxEnvironment(
//       "AYULgCpmdmH30YkpN4wPyPyV8zLVs6xjhAPf4xn5L7630tjjKtVYq36-24QrTOY4ZqsauweNE3IoCoQv",
//       "EIp7U4Y4Z9RU5moIZrOxW_KaXgPCC94x2fMlXmqHOs9Hp7u-kKjpx5iPv8tULuRXZ7RwJBr3rtXGPo0a"
//     );

//     if (
//       mode === "live" &&
//       config.paypal &&
//       config.paypal.client_id &&
//       config.paypal.client_secret
//     ) {
//       env = new paypal.core.LiveEnvironment(
//         config.paypal.client_id,
//         config.paypal.client_secret
//       );
//     }
//     let client = new paypal.core.PayPalHttpClient(env);
//     let getOrder = new paypal.v1.orders.OrdersGetRequest(orderID);
//     client
//       .execute(getOrder)
//       .then(
//         ({
//           statusCode,
//           result: { status, gross_total_amount, create_time, payer },
//         }) => {
//           console.log(
//             "Paypal LOGGING ",
//             mode,
//             type,
//             orderID,
//             uid,
//             status,
//             gross_total_amount,
//             create_time,
//             payer
//           );
//           const plan = PLANS.find((x) => x.value === type);
//           console.log(plan, type, PLANS);

//           if (
//             statusCode < 400 &&
//             status === "COMPLETED" &&
//             parseFloat(gross_total_amount.value) === plan.price
//           ) {
//             const expiresOn = +new Date(+new Date(create_time) + plan.time);
//             const rootRef = admin.database().ref();
//             const paidOn = +new Date();
//             rootRef.child("paid/" + uid + "/").set({
//               paidOn,
//               expiresOn,
//               orderID,
//               payer,
//               gross_total_amount,
//               mode,
//             });
//             rootRef.child("transactions/").push({
//               uid,
//               paidOn,
//               expiresOn,
//               orderID,
//               payer,
//               gross_total_amount,
//               mode,
//             });
//             return res.json({ expiresOn, payer: payer });
//           } else {
//             return res.status(400).json({
//               type: "invalid_request_error",
//               message: "Order invalid",
//               extra: { orderID, uid, type, mode },
//             });
//           }
//         }
//       )
//       .catch((error) => {
//         console.error(error, mode, type, orderID, uid);
//         return res.status(500).json({
//           type: "api_error",
//           message: error,
//           extra: { error, orderID, uid, type, mode },
//         });
//       });
//   });
// });

// This is a Hello World function which writes to the database.
export const paid = functions.database
  .ref("/paid/{uid}")
  .onWrite(async (event) => {
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
        admins.map(async (uid) => {
          const toks = await admin
            .database()
            .ref(`/messages/${uid}/tokens`)
            .once("value");
          const toks2 = Object.keys(toks.val() || {});
          toks2.forEach((token) => {
            tokens[token] = uid;
          });
          return toks2;
        })
      );
      // For each token send message
      const payload = {
        notification: {
          title: `${payer.name.given_name} signed up!`,
          body: `${payer.name.given_name} ${payer.name.surname} paid ${gross_total_amount.value} - ${payer.email_address}`,
        },
      };
      const tokensList = Object.keys(tokens);
      return admin
        .messaging()
        .sendToDevice(tokensList, payload)
        .then((response) => {
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
