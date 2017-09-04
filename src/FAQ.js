import React, { Component } from 'react';

// const Question = ({ children }) =>
//   <h3>
//     {children}
//   </h3>;

// const Answer = ({ children }) =>
//   <p>
//     {children}
//   </p>;

// const

const qa = [
  [
    'Who made this site and how do I leave feedback?',
    'Harsh Singh made this site and you can reach him through the feedback form or by email: '
  ],
  [
    'What happens with my yearly payment to access this site?',
    '100% of the payment is donated to embracing the world charities.'
  ],
  [
    "I have an IPhone/IPad/IPod/Windows phone. Why can't I use this site offline?",
    'Unfortunately, safari ie11 and the edge browser does not support service workers, a feature that allows me to save content for offline use. While the release date for the feature is not yet announced, this feature is highly anticipated and is actively being developed at apple. If you value having bhajans easily accessible offline please buy an android phone/tablet. Note, chrome on safari is basically safari with different clothes and also does not support service workers.'
  ]
];

export default class FAQ extends Component {
  render() {
    return (
      <div>
        <ul>
          {qa.map(([question, answer]) =>
            <li>
              <h3>
                {question}
              </h3>
              <p>
                {answer}
              </p>
            </li>
          )}
        </ul>
      </div>
    );
  }
}
