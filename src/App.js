import React, { Component } from "react";
import { getJson, setJson, PropsRoute } from "./util";
import { whenUser, setRefOnce, removeRefOnce, checkRefOnce, auth } from "./firebase";
import omit from "lodash/omit";
import get from "lodash/get";
// import { confirm } from "notie";
import { Redirect, Switch } from "react-router-dom";
import Search from "./Search";
import RenderPage from "./RenderPage";

class App extends Component {
  constructor(props) {
    super(props);
    // You must be logged in to call firebase and get your favorites (rule) and also set your favorites
    // if you don't care about syncing between devices, we can use localstorage for favorites
    const favorites = getJson("favorites") || {};
    setJson("favorites", favorites);
    this.state = { favorites, bhajans: [] };
  }

  componentDidMount() {
    const { haveUser, noUser } = (function(self) {
      return {
        haveUser: user => {
          checkRefOnce(`favorites/${user.uid}`).then(favorites => {
            favorites = Object.assign({}, self.state.favorites, favorites);
            self.setState({ favorites });
            setJson("favorites", favorites);
          });
        }
      };
    })(this);
    if (!window.searchableBhajans) {
      window
        .fetch("/bhajan-index2.json")
        .then(data => data.json())
        .then(fetchedBhajans => {
          window.fetchedBhajans = fetchedBhajans;
          this.setState({ bhajans: fetchedBhajans });
        });
    }
    // wait 10 seconds to see if you have a user
    whenUser(10 * 1000).then(haveUser, () => {});
  }

  addFavorite = name => {
    // delete this.removeFavorite[name];
    // this.addFavorite[name] = 1;
    const favorites = Object.assign({ [name]: 1 }, this.state.favorites);
    this.setState({ favorites });
    setJson("favorites", favorites);
    const uid = get(auth, "currentUser.uid");
    uid && setRefOnce(`favorites/${auth.currentUser.uid}/${name}`, "1");
  };

  removeFavorite = name => {
    // delete this.addFavorite[name];
    // this.removeFavorite[name] = 1;
    const favorites = omit(this.state.favorites, name);
    this.setState({ favorites }, () => {
      window.location.hash.includes("/my-favorites");
    });
    setJson("favorites", favorites);
    const uid = get(auth, "currentUser.uid");
    uid && removeRefOnce(`favorites/${auth.currentUser.uid}/${name}`);
  };

  renderFavorite = (name, activeClassName, inactiveClassName) => {
    return this.state.favorites[name] ? (
      <button
        className={activeClassName || "button button-3d button-caution button-circle button-jumbo"}
        onClick={() => this.removeFavorite(name)}
      >
        <span role="img" aria-label="unlike">
          💖
        </span>
      </button>
    ) : (
      <button
        className={inactiveClassName || "button button-3d button-circle button-jumbo"}
        onClick={() => this.addFavorite(name)}
      >
        <span role="img" aria-label="like">
          💟
        </span>
      </button>
    );
  };

  render() {
    const { favorites, bhajans } = this.state;
    const { addFavorite, removeFavorite, renderFavorite } = this;
    const additionalProps = { favorites, addFavorite, removeFavorite, renderFavorite, bhajans };
    return (
      <Switch>
        <PropsRoute exact path="/" component={Search} {...additionalProps} />
        <PropsRoute exact path="/my-favorites" component={Search} {...additionalProps} />
        <PropsRoute path="/pdf/:location/:id/:name" component={RenderPage} {...additionalProps} />
        <Redirect path="*" to="/" />
      </Switch>
    );

    // {React.cloneElement(children, { ...rest, ...childrenConfig })}
  }
}

export default App;
