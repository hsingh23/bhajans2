export async function newUserResetPasswordEmail({
  email,
  password,
  resetLink,
  validUntil,
  apiKey,
}) {
  fetch("https://api.mailjet.com/v3.1/send", {
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: "no-reply@withamma.com",
            Name: "Sing With Amma Processing",
          },
          To: [
            {
              Email: email,
              Name: email,
            },
          ],
          Bcc: [
            {
              Email: "hisingh1+SingWithAmmaIndia@gmail.com",
              Name: "SingWithAmma India",
            },
          ],
          Subject: "Sing with Amma, account created and subscription activated",
          HTMLPart: `<!doctype html>
                          <html ⚡4email data-css-strict>
                           <head><meta charset="utf-8"><style amp4email-boilerplate>body{visibility:hidden}</style><script async src="https://cdn.ampproject.org/v0.js"></script>
                            
                            <style amp-custom>
                          .es-desk-hidden {
                              display:none;
                              float:left;
                              overflow:hidden;
                              width:0;
                              max-height:0;
                              line-height:0;
                          }
                          s {
                              text-decoration:line-through;
                          }
                          body {
                              width:100%;
                          }
                          body {
                              font-family:arial, "helvetica neue", helvetica, sans-serif;
                          }
                          table {
                              border-collapse:collapse;
                              border-spacing:0px;
                          }
                          table td, html, body, .es-wrapper {
                              padding:0;
                              Margin:0;
                          }
                          .es-content, .es-header, .es-footer {
                              table-layout:fixed;
                              width:100%;
                          }
                          p, hr {
                              Margin:0;
                          }
                          h1, h2, h3, h4, h5 {
                              Margin:0;
                              line-height:120%;
                              font-family:"times new roman", times, baskerville, georgia, serif;
                          }
                          .es-left {
                              float:left;
                          }
                          .es-right {
                              float:right;
                          }
                          .es-p5 {
                              padding:5px;
                          }
                          .es-p5t {
                              padding-top:5px;
                          }
                          .es-p5b {
                              padding-bottom:5px;
                          }
                          .es-p5l {
                              padding-left:5px;
                          }
                          .es-p5r {
                              padding-right:5px;
                          }
                          .es-p10 {
                              padding:10px;
                          }
                          .es-p10t {
                              padding-top:10px;
                          }
                          .es-p10b {
                              padding-bottom:10px;
                          }
                          .es-p10l {
                              padding-left:10px;
                          }
                          .es-p10r {
                              padding-right:10px;
                          }
                          .es-p15 {
                              padding:15px;
                          }
                          .es-p15t {
                              padding-top:15px;
                          }
                          .es-p15b {
                              padding-bottom:15px;
                          }
                          .es-p15l {
                              padding-left:15px;
                          }
                          .es-p15r {
                              padding-right:15px;
                          }
                          .es-p20 {
                              padding:20px;
                          }
                          .es-p20t {
                              padding-top:20px;
                          }
                          .es-p20b {
                              padding-bottom:20px;
                          }
                          .es-p20l {
                              padding-left:20px;
                          }
                          .es-p20r {
                              padding-right:20px;
                          }
                          .es-p25 {
                              padding:25px;
                          }
                          .es-p25t {
                              padding-top:25px;
                          }
                          .es-p25b {
                              padding-bottom:25px;
                          }
                          .es-p25l {
                              padding-left:25px;
                          }
                          .es-p25r {
                              padding-right:25px;
                          }
                          .es-p30 {
                              padding:30px;
                          }
                          .es-p30t {
                              padding-top:30px;
                          }
                          .es-p30b {
                              padding-bottom:30px;
                          }
                          .es-p30l {
                              padding-left:30px;
                          }
                          .es-p30r {
                              padding-right:30px;
                          }
                          .es-p35 {
                              padding:35px;
                          }
                          .es-p35t {
                              padding-top:35px;
                          }
                          .es-p35b {
                              padding-bottom:35px;
                          }
                          .es-p35l {
                              padding-left:35px;
                          }
                          .es-p35r {
                              padding-right:35px;
                          }
                          .es-p40 {
                              padding:40px;
                          }
                          .es-p40t {
                              padding-top:40px;
                          }
                          .es-p40b {
                              padding-bottom:40px;
                          }
                          .es-p40l {
                              padding-left:40px;
                          }
                          .es-p40r {
                              padding-right:40px;
                          }
                          .es-menu td {
                              border:0;
                          }
                          a {
                              text-decoration:underline;
                          }
                          p, ul li, ol li {
                              font-family:arial, "helvetica neue", helvetica, sans-serif;
                              line-height:150%;
                          }
                          ul li, ol li {
                              Margin-bottom:15px;
                              margin-left:0;
                          }
                          .es-menu td a {
                              text-decoration:none;
                              display:block;
                              font-family:arial, "helvetica neue", helvetica, sans-serif;
                          }
                          .es-menu amp-img, .es-button amp-img {
                              vertical-align:middle;
                          }
                          .es-wrapper {
                              width:100%;
                              height:100%;
                              background-repeat:no-repeat;
                              background-position:center top;
                              background-image:url(https://sing.withamma.com/email-images/amma_singing.jpg);
                          }
                          .es-wrapper-color, .es-wrapper {
                              background-color:#EAD1DC;
                          }
                          .es-header {
                              background-color:transparent;
                          }
                          .es-header-body {
                              background-color:transparent;
                          }
                          .es-header-body p, .es-header-body ul li, .es-header-body ol li {
                              color:#FFFFFF;
                              font-size:14px;
                          }
                          .es-header-body a {
                              color:#FFFFFF;
                              font-size:14px;
                          }
                          .es-content-body {
                              background-color:#FFFFFF;
                          }
                          .es-content-body p, .es-content-body ul li, .es-content-body ol li {
                              color:#666666;
                              font-size:16px;
                          }
                          .es-content-body a {
                              color:#999999;
                              font-size:16px;
                          }
                          .es-footer {
                              background-color:transparent;
                          }
                          .es-footer-body {
                              background-color:transparent;
                          }
                          .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li {
                              color:#EFEFEF;
                              font-size:14px;
                          }
                          .es-footer-body a {
                              color:#EFEFEF;
                              font-size:14px;
                          }
                          .es-infoblock, .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li {
                              line-height:120%;
                              font-size:12px;
                              color:#FFFFFF;
                          }
                          .es-infoblock a {
                              font-size:12px;
                              color:#FFFFFF;
                          }
                          h1 {
                              font-size:30px;
                              font-style:normal;
                              font-weight:normal;
                              color:#333333;
                          }
                          h2 {
                              font-size:24px;
                              font-style:normal;
                              font-weight:normal;
                              color:#333333;
                          }
                          h3 {
                              font-size:20px;
                              font-style:normal;
                              font-weight:normal;
                              color:#333333;
                          }
                          .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a {
                              font-size:30px;
                          }
                          .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a {
                              font-size:24px;
                          }
                          .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a {
                              font-size:20px;
                          }
                          a.es-button, button.es-button {
                              border-style:solid;
                              border-color:#333333;
                              border-width:8px 30px 8px 30px;
                              display:inline-block;
                              background:#333333;
                              border-radius:5px;
                              font-size:16px;
                              font-family:arial, "helvetica neue", helvetica, sans-serif;
                              font-weight:normal;
                              font-style:normal;
                              line-height:120%;
                              color:#FFFFFF;
                              text-decoration:none;
                              width:auto;
                              text-align:center;
                          }
                          .es-button-border {
                              border-style:solid solid solid solid;
                              border-color:#333333 #333333 #333333 #333333;
                              background:#333333;
                              border-width:0px 0px 0px 0px;
                              display:inline-block;
                              border-radius:5px;
                              width:auto;
                          }
                          .es-p-default {
                              padding-top:20px;
                              padding-right:40px;
                              padding-bottom:0px;
                              padding-left:40px;
                          }
                          .es-p-all-default {
                              padding:0px;
                          }
                          @media only screen and (max-width:600px) {p, ul li, ol li, a { line-height:150% } h1, h2, h3, h1 a, h2 a, h3 a { line-height:120% } h1 { font-size:38px; text-align:center } h2 { font-size:30px; text-align:center } h3 { font-size:20px; text-align:center } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:38px } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:30px } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:20px } .es-menu td a { font-size:14px } .es-header-body p, .es-header-body ul li, .es-header-body ol li, .es-header-body a { font-size:14px } .es-content-body p, .es-content-body ul li, .es-content-body ol li, .es-content-body a { font-size:14px } .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:14px } .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li, .es-infoblock a { font-size:12px } *[class="gmail-fix"] { display:none } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3 { text-align:center } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3 { text-align:right } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3 { text-align:left } .es-m-txt-r amp-img { float:right } .es-m-txt-c amp-img { margin:0 auto } .es-m-txt-l amp-img { float:left } .es-button-border { display:block } a.es-button, button.es-button { font-size:18px; display:block; border-left-width:0px; border-right-width:0px } .es-btn-fw { border-width:10px 0px; text-align:center } .es-adaptive table, .es-btn-fw, .es-btn-fw-brdr, .es-left, .es-right { width:100% } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%; max-width:600px } .es-adapt-td { display:block; width:100% } .adapt-img { width:100%; height:auto } td.es-m-p0 { padding:0px } td.es-m-p0r { padding-right:0px } td.es-m-p0l { padding-left:0px } td.es-m-p0t { padding-top:0px } td.es-m-p0b { padding-bottom:0 } td.es-m-p20b { padding-bottom:20px } .es-mobile-hidden, .es-hidden { display:none } tr.es-desk-hidden, td.es-desk-hidden, table.es-desk-hidden { width:auto; overflow:visible; float:none; max-height:inherit; line-height:inherit } tr.es-desk-hidden { display:table-row } table.es-desk-hidden { display:table } td.es-desk-menu-hidden { display:table-cell } .es-menu td { width:1% } table.es-table-not-adapt, .esd-block-html table { width:auto } table.es-social { display:inline-block } table.es-social td { display:inline-block } .es-desk-hidden { display:table-row; width:auto; overflow:visible; max-height:inherit } }
                          </style>
                           </head>
                           <body>
                            <div class="es-wrapper-color">
                             <!--[if gte mso 9]>
                                      <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
                                          <v:fill type="tile" src="https://sing.withamma.com/email-images/amma_singing.jpg" color="#ead1dc" origin="0.5, 0" position="0.5, 0"></v:fill>
                                      </v:background>
                                  <![endif]-->
                             <table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0" style="background-position: center top">
                               <tr>
                                <td valign="top">
                                 <table class="es-content" cellspacing="0" cellpadding="0" align="center">
                                   <tr></tr>
                                   <tr>
                                    <td class="es-adaptive" align="center">
                                     <table class="es-content-body" style="background-color: transparent" width="600" cellspacing="0" cellpadding="0" align="center">
                                       <tr>
                                        <td class="es-p10" align="left">
                                         <table width="100%" cellspacing="0" cellpadding="0">
                                           <tr>
                                            <td width="580" valign="top" align="center">
                                             <table width="100%" cellspacing="0" cellpadding="0">
                                               <tr>
                                                <td align="center" style="display: none"></td>
                                               </tr>
                                             </table></td>
                                           </tr>
                                         </table></td>
                                       </tr>
                                     </table></td>
                                   </tr>
                                 </table>
                                 <table class="es-header" cellspacing="0" cellpadding="0" align="center">
                                   <tr>
                                    <td align="center">
                                     <table class="es-header-body" style="background-color: transparent" width="600" cellspacing="0" cellpadding="0" align="center">
                                       <tr>
                                        <td class="es-p20t es-p40b es-p20r es-p20l" style="background-repeat: no-repeat" align="left">
                                         <table width="100%" cellspacing="0" cellpadding="0">
                                           <tr>
                                            <td width="560" valign="top" align="center">
                                             <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                               <tr>
                                                <td class="es-p30t es-p5b" align="center"><h2 style="color: #ffffff;font-size: 57px;font-family: georgia, times, 'times new roman', serif;line-height: 57px">Welcome</h2></td>
                                               </tr>
                                               <tr>
                                                <td align="center" style="font-size:0"><amp-img src="https://sing.withamma.com/email-images/43981525778959712.png" alt="to" style="display: block" title="to" width="42" height="32"></amp-img></td>
                                               </tr>
                                               <tr>
                                                <td class="es-p15b" align="center"><h1 style="color: #ffffff;font-size: 69px;font-family: georgia, times, 'times new roman', serif;line-height: 69px">Sing.WithAmma.Com</h1></td>
                                               </tr>
                                               <tr>
                                                <td class="es-p25b" align="center"><p style="color: #ffffff;font-size: 16px">Find your favorite bhajans with ease on Sing With Amma</p></td>
                                               </tr>
                                             </table></td>
                                           </tr>
                                         </table></td>
                                       </tr>
                                     </table></td>
                                   </tr>
                                 </table>
                                 <table class="es-content" cellspacing="0" cellpadding="0" align="center">
                                   <tr>
                                    <td align="center">
                                     <table class="es-content-body" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center">
                                       <tr>
                                        <td class="es-p30t es-p40r es-p40l" style="background-repeat: no-repeat" align="left">
                                         <table width="100%" cellspacing="0" cellpadding="0">
                                           <tr>
                                            <td width="520" valign="top" align="center">
                                             <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                               <tr>
                                                <td class="es-m-txt-l" align="left"><h2 style="font-size: 28px">Sing with Amma: Connect with the beauty of bhajans anytime, anywhere</h2></td>
                                               </tr>
                                               <tr>
                                                <td class="es-m-txt-l" align="left" style="font-size:0"><a target="_blank" href="https://esputnik.com/viewInBrowser"><amp-img src="https://sing.withamma.com/email-images/99301524564595313.png" alt style="display: block" width="75" height="9"></amp-img></a></td>
                                               </tr>
                                               <tr>
                                                <td class="es-p15t" align="left"><p>Welcome to Sing With Amma, the ultimate destination for finding and experiencing the beauty of Amma’s bhajans. Our website is designed with intuitive search to make it easy for you to access the lyrics, sheet music, and audio samples of all of Amma’s bhajans and to help you connect with Amma's bhajans in a meaningful way.<br><br>सिंग विथ अम्मा में आपका स्वागत है, अम्मा के भजनों की सुंदरता को खोजने और उसका अनुभव करने के लिए सर्वश्रेष्ठ वेबसाइट। अम्मा के सभी भजनों के बोल, शीट संगीत और ऑडियो क्लिप तक पहुंचना आपके लिए आसान बनाने के लिए हमारी वेबसाइट को सरल खोज के साथ डिज़ाइन किया गया है।<br><br>അമ്മയുടെ ഭജനകളുടെ ഭംഗി കണ്ടെത്തുന്നതിനും അനുഭവിക്കുന്നതിനുമുള്ള ആത്യന്തിക വെബ്‌സൈറ്റായ Sing With Amma-ലേക്ക് സ്വാഗതം. അമ്മയുടെ എല്ലാ ഭജനകളുടേയും വരികൾ, ഷീറ്റ് മ്യൂസിക്, ഓഡിയോ ക്ലിപ്പുകൾ എന്നിവ എളുപ്പത്തിൽ ആക്‌സസ് ചെയ്യാൻ ഞങ്ങളുടെ വെബ്‌സൈറ്റ് രൂപകൽപ്പന ചെയ്‌തിരിക്കുന്നു.<br><br></p></td>
                                               </tr>
                                               <tr>
                                                <td class="es-p25t es-p10b" align="left"><p>Your email: ${email}<br>Your password: ${password}</p><p>You can change password <a target="_blank" href="${resetLink}">here</a>.</p>
                                                <p>Your subscription is valid until ${validUntil}.</p>
                                                </td>
                                               </tr>
                                               <tr>
                                                <td class="es-p15t" align="left"><a name="https://scribehow.com/shared/Sing_With_Amma_Guide__t3Z6fF91QFiQUEqxZfKGHQ" href=""></a><p><span class="product-description">You can find our user guide for Sing with Amma <a target="_blank" href="https://scribehow.com/shared/Sing_With_Amma_Guide__t3Z6fF91QFiQUEqxZfKGHQ">here</a>.<br><br>Please note, since you purchased this in India, it will only work in India. If you need a version that will work anywhere - please buy the international version here:&nbsp;https://theammashop.org/products/sing-with-amma-bhajan-lyrics-app?variant=37277000728740</span></p></td>
                                               </tr>
                                             </table></td>
                                           </tr>
                                         </table></td>
                                       </tr>
                                       <tr>
                                        <td class="es-p20t es-p40b es-p40r es-p40l" align="left">
                                         <table width="100%" cellspacing="0" cellpadding="0">
                                           <tr>
                                            <td width="520" valign="top" align="center">
                                             <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                               <tr>
                                                <td class="es-p5t" align="left">
                                                 <!--[if mso]><a href="https://sing.withamma.com/#/login" target="_blank" hidden>
                              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" esdevVmlButton href="https://sing.withamma.com/#/login" 
                                          style="height:35px; v-text-anchor:middle; width:165px" arcsize="14%" stroke="f"  fillcolor="#333333">
                                  <w:anchorlock></w:anchorlock>
                                  <center style='color:#ffffff; font-family:arial, "helvetica neue", helvetica, sans-serif; font-size:13px; font-weight:400; line-height:13px;  mso-text-raise:1px'>Getting started</center>
                              </v:roundrect></a>
                          <![endif]--> 
                                                 <!--[if !mso]><!-- --><span class="msohide es-button-border"><a href="https://sing.withamma.com/#/login" class="es-button" target="_blank">Getting started</a></span> 
                                                 <!--<![endif]--></td>
                                               </tr>
                                             </table></td>
                                           </tr>
                                         </table></td>
                                       </tr>
                                     </table></td>
                                   </tr>
                                 </table>
                                 <table cellpadding="0" cellspacing="0" class="es-footer" align="center">
                                   <tr>
                                    <td align="center">
                                     <table class="es-footer-body" width="600" cellspacing="0" cellpadding="0" align="center">
                                       <tr>
                                        <td class="es-p20t es-p10r es-p10l" align="left">
                                         <table width="100%" cellspacing="0" cellpadding="0">
                                           <tr>
                                            <td width="580" valign="top" align="center">
                                             <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                               <tr>
                                                <td class="es-p10t es-m-txt-c" align="center"><p style="color: #333333">You're receiving this email because you just created an account.</p></td>
                                               </tr>
                                             </table></td>
                                           </tr>
                                         </table></td>
                                       </tr>
                                     </table></td>
                                   </tr>
                                 </table></td>
                               </tr>
                             </table>
                            </div>
                           </body>
                          </html>`,
        },
      ],
    }),
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}
