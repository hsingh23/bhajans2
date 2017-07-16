import React, { Component } from 'react';
import { getJson, setJson, PropsRoute } from './util';
import { whenUser, setRefOnce, removeRefOnce, checkRefOnce, auth } from './firebase';
import omit from 'lodash/omit';
import get from 'lodash/get';
import { confirm } from 'notie';
import { Redirect, Switch } from 'react-router-dom';
import Search from './Search';
import RenderPage from './RenderPage';

class App extends Component {
  constructor(props) {
    super(props);
    // You must be logged in to call firebase and get your favorites (rule) and also set your favorites
    // if you don't care about syncing between devices, we can use localstorage for favorites
    const favorites = getJson('favorites') || {};
    setJson('favorites', favorites);
    this.state = { favorites };
  }

  componentDidMount() {
    const { haveUser, noUser } = (function (self) {
      return {
        haveUser: user => {
          checkRefOnce(`favorites/${user.uid}`).then(favorites => {
            favorites = Object.assign({}, self.state.favorites, favorites);
            self.setState({ favorites });
            setJson('favorites', favorites);
          });
        },
        noUser: reason => {
          confirm({ text: 'Login to sync favorite?' }, () => self.props.history.push('/login'));
          console.log(`No user: ${reason}`);
        },
      };
    })(this);

    whenUser(3000).then(haveUser, noUser);
  }

  addFavorite = name => {
    // delete this.removeFavorite[name];
    // this.addFavorite[name] = 1;
    const favorites = Object.assign({ [name]: 1 }, this.state.favorites);
    this.setState({ favorites });
    setJson('favorites', favorites);
    const uid = get(auth, 'currentUser.uid');
    uid && setRefOnce(`favorites/${auth.currentUser.uid}/${name}`, '1');
  };

  removeFavorite = name => {
    // delete this.addFavorite[name];
    // this.removeFavorite[name] = 1;
    const favorites = omit(this.state.favorites, name);
    this.setState({ favorites }, () => {
      window.location.hash.includes('/my-favorites');
    });
    setJson('favorites', favorites);
    const uid = get(auth, 'currentUser.uid');
    uid && removeRefOnce(`favorites/${auth.currentUser.uid}/${name}`);
  };

  renderFavorite = (name, activeClassName, inactiveClassName) => {
    return this.state.favorites[name]
      ? <button className={activeClassName || 'button button-3d button-caution button-circle button-jumbo'} onClick={() => this.removeFavorite(name)}>
        ♥
          </button>
      : <button className={inactiveClassName || 'button button-3d button-circle button-jumbo'} onClick={() => this.addFavorite(name)}>
        ♡
          </button>;
  };

  render() {
    const { favorites } = this.state;
    const { addFavorite, removeFavorite, renderFavorite } = this;
    const additionalProps = { favorites, addFavorite, removeFavorite, renderFavorite };
    return <Switch>
      <PropsRoute exact path="/" component={Search} {...additionalProps} />
      <PropsRoute exact path="/my-favorites" component={Search}  {...additionalProps} />
      <PropsRoute path="/pdf/:location/:name" component={RenderPage}  {...additionalProps} />
      <Redirect path='*' to='/' />
    </Switch>

    // {React.cloneElement(children, { ...rest, ...childrenConfig })}
  }
};

export default App;
