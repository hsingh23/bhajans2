import { Link } from "react-router-dom";
import Button from "@mui/material/Button";
import Header from "./Header";
import { track, gaClientId } from "./analytics";
import { setRefOnce } from "./firebase";

// Shopify variant -> plan shown on the buttons below.
export const PLANS = [
  { variant: "37277000728740", plan: "1 year", label: "1 Years", value: 10 },
  { variant: "37277000794276", plan: "5 years", label: "5 Years", value: 40 },
  { variant: "37277000827044", plan: "10 years", label: "10 Years", value: 50 },
];

const startCheckout = ({ variant, plan, value }, uid) => {
  track("begin_checkout", {
    plan,
    value,
    currency: "USD",
    items: [{ item_id: variant, item_name: `Sing with Amma ${plan}`, price: value, quantity: 1 }],
  });
  // Lets the Shopify webhook attribute the purchase to this visitor in GA4.
  const clientId = gaClientId();
  if (uid && clientId) setRefOnce(`messages/${uid}/gaClientId`, clientId);
};

const Pay = () => {


  const { email, displayName, expiresOn = undefined, uid } = localStorage;
  const cleanedDisplayName = displayName || "";
  const expiry = new Date(+expiresOn);
  const otherAccountHint =
    " If you paid with a different email address, please log out and sign in with that address.";
  const paymentMessage =
    expiry > new Date()
      ? ` and your membership expires on ${expiry.toLocaleDateString()}.`
      : expiresOn
        ? ` and your membership expired on ${expiry.toLocaleDateString()}.${otherAccountHint}`
        : ` and you have not yet paid for the app.${otherAccountHint}`;

  const body = encodeURIComponent(`Om namaha shivaya,
I'm having payment issues. My Paypal transaction number is:

-----
name: ${cleanedDisplayName}
email: ${email}
uid: ${uid}
expiresOn: ${expiresOn}`);

  let helloText = cleanedDisplayName ? `Hello ${cleanedDisplayName}` : "Hello";

  return (
    <div className='App'>
      <Header title="Payments" />
      <div className='pay'>
        <h1>Payments</h1>
        {email ? (
          <p className='yellowBg'>
            {helloText}, you are signed in with the email {email}{" "}
            {paymentMessage}
            <br />
            <Link to='/'>Home (Bhajan List)</Link>
            <br />
            <Link to='/logout'>Logout / Change User</Link>
          </p>
        ) : (
          <p className='yellowBg'>
            Please <Link to={`/login?next=${encodeURIComponent('/pay')}`}>sign in</Link> first so
            your payment is linked to your account.
            <br />
            <Link to='/'>Home (Bhajan List)</Link>
          </p>
        )}

        <iframe
          width='100%'
          height='500'
          src='https://www.youtube.com/embed/Wm5Nc3tR_kI'
          title='YouTube video player'
          frameBorder='0'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen></iframe>

        <p>
          <strong>
            All the money (except for taxes and payment gateway fees) goes to{" "}
            <a href='http://www.embracingtheworld.org/'>
              Embracing the World
            </a>{" "}
            nonprofit. Please note there are NO refunds due to payment
            processing restrictions. Please be sure to double check your order
            before paying!
          </strong>
        </p>
        {email && (
          <>
          <h4>
            Important: When checking out, please use the email - {email}{" "}
            (should be autofilled). DO NOT change this as this will make it
            harder to link your account.
          </h4>

          <h3>
            Please allow two business day for your account to be enabled - the
            process is manual.
          </h3>

          <h2 style={{ textAlign: "center" }}>Payment links</h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              margin: "20px",
            }}>
            {PLANS.map((option) => (
              <Button
                key={option.variant}
                variant='contained'
                color='primary'
                onClick={() => startCheckout(option, uid)}
                href={`http://theammashop.com/cart/${option.variant}:1?email=${email}`}>
                {option.label} - ${option.value}
              </Button>
            ))}
          </div>
          </>
        )}

        <p>
          For any payment complications please send your email{" "}
          <a
            href={`mailto:singwithamma@gmail.com?subject=[swa] Payment&body=${body}`}>
            here
          </a>
        </p>
      </div>
    </div>
  );
};

export default Pay;
