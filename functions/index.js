'use strict';var _regenerator = require('babel-runtime/regenerator');var _regenerator2 = _interopRequireDefault(_regenerator);var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} // // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
var functions = require('firebase-functions');
var admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// This is a Hello World function which writes to the database.
exports.confirmBeta = functions.database.ref('/confirmBeta/{uid}').onWrite(function () {var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(event) {var userInfo, tokens, admins, potentialUsersTokens, payload, tokensList;return _regenerator2.default.wrap(function _callee$(_context) {while (1) {switch (_context.prev = _context.next) {case 0:
            userInfo = event.data.val();if (!
            userInfo) {_context.next = 21;break;}
            console.log(userInfo);
            tokens = {};
            // get list of admins
            _context.t0 = Object;_context.next = 7;return admin.database().ref('/admin').once('value');case 7:_context.t1 = _context.sent.val();if (_context.t1) {_context.next = 10;break;}_context.t1 = {};case 10:_context.t2 = _context.t1;admins = _context.t0.keys.call(_context.t0, _context.t2);
            console.log(admins);

            // for each admin, get tokens
            _context.next = 15;return Promise.all(admins.map(function (uid) {return admin.database().ref('/messages/' + uid + '/tokens').once('value');}));case 15:potentialUsersTokens = _context.sent;
            potentialUsersTokens.forEach(function (usersTokens) {
              if (usersTokens.val()) {
                Object.keys(usersTokens.val()).forEach(function (token, index) {
                  // associate the token with the uid in case you need to remove a bad token
                  tokens[token] = admins[index];
                  console.log('Found token ' + token + ' for ' + admins[index]);
                });
              }
            });
            // for each token send message
            payload = {
              notification: {
                title: 'New user awaiting access!',
                body: userInfo.name + ' is waiting to joing beta.',
                clickAction: 'https://sing.withamma.com/#/admin' } };


            tokensList = Object.keys(tokens);
            console.log('tokensList', tokensList);return _context.abrupt('return',
            admin.messaging().sendToDevice(tokensList, payload).then(function (response) {
              // For each message check if there was an error.
              var tokensToRemove = [];
              response.results.forEach(function (result, index) {
                var error = result.error;
                if (error) {
                  console.error('Failure sending notification to', tokensList[index], error);
                  // Cleanup the tokens who are not registered anymore.
                  if (error.code === 'messaging/invalid-registration-token' ||
                  error.code === 'messaging/registration-token-not-registered') {
                    tokensToRemove.push(admin.database().ref('/messages/' + tokens[tokensList[index]] + '/tokens/' + tokensList[index]).remove());
                  }
                }
              });
              return Promise.all(tokensToRemove);
            }));case 21:case 'end':return _context.stop();}}}, _callee, undefined);}));return function (_x) {return _ref.apply(this, arguments);};}());