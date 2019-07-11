import React, { Component } from "react";
import { getJson, setJson, PropsRoute } from "./util";
import { whenUser, setRefOnce, removeRefOnce, checkRefOnce, auth } from "./firebase";
import { omit, get, orderBy } from "lodash-es";

// import { confirm } from "notie";
import { Redirect, Switch } from "react-router-dom";
import Search from "./Search";
import Profile from "./Profile";
import RenderPage from "./RenderPage";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faHeart,
  faMusic,
  faPlay,
  faStop,
  faCompactDisc,
  faCartArrowDown,
  faInfo
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Pay from "./Pay";

library.add(faHeart, faMusic, faPlay, faStop, faCompactDisc, faCartArrowDown, faInfo);
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
    const { haveUser } = (function(self) {
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

    window
      .fetch("/bhajan-index2.json")
      .then(data => data.json())
      .then(fetchedBhajans => {
        fetchedBhajans = orderBy(fetchedBhajans, ["n", "t"], ["asc", "asc"]);
        window.fetchedBhajans = fetchedBhajans;
        this.setState({ bhajans: fetchedBhajans });
      });

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
        <FontAwesomeIcon icon="heart" color="white" />
      </button>
    ) : (
      <button
        className={inactiveClassName || "button button-3d button-circle button-jumbo"}
        onClick={() => this.addFavorite(name)}
      >
        <FontAwesomeIcon icon="heart" color="grey" />
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
        <PropsRoute exact path="/pay" component={Pay} />
        <PropsRoute exact path="/profile" component={Profile} />
        <PropsRoute exact path="/my-favorites" component={Search} {...additionalProps} />
        <PropsRoute path="/pdf/:location/:id/:name" component={RenderPage} {...additionalProps} />
        <Redirect path="*" to="/" />
      </Switch>
    );

    // {React.cloneElement(children, { ...rest, ...childrenConfig })}
  }
}

export default App;
