// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from "react";
import { auth, checkRefOnce, syncUserData } from "./firebase";
import { 
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { getNext } from "./util";
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Snackbar, 
  Alert,
  CircularProgress,
  Fade
} from "@mui/material";
import Header from "./Header";

// Query params Firebase adds to the return URL of an email link
const LINK_PARAMS = ['apiKey', 'oobCode', 'mode', 'lang'];
const USED_LINK_CODES = ['auth/invalid-action-code', 'auth/expired-action-code'];
const WRONG_ADDRESS_MESSAGE = "This link was sent to a different email address. Please enter the address it was sent to.";
const USED_LINK_MESSAGE = "This sign-in link has expired or was already used. Please request a new link.";
const WRONG_PASSWORD_MESSAGE = "That email and password don't match. If you set a new password, please sign in with the same email address, or use a magic link instead.";

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': WRONG_PASSWORD_MESSAGE,
  'auth/invalid-login-credentials': WRONG_PASSWORD_MESSAGE,
  'auth/wrong-password': WRONG_PASSWORD_MESSAGE,
  'auth/user-not-found': WRONG_PASSWORD_MESSAGE,
  'auth/invalid-email': "Please enter a valid email address.",
  'auth/too-many-requests': "Too many attempts. Please wait a few minutes and try again.",
  'auth/user-disabled': "This account has been disabled. Please contact singwithamma@gmail.com.",
  'auth/network-request-failed': "We couldn't reach the server. Please check your connection and try again.",
};

const authErrorMessage = (error) =>
  AUTH_ERROR_MESSAGES[error.code] ||
  `Something went wrong${error.code ? ` (${error.code})` : ""}. Please try again.`;

const Login = () => {
  const navigate = useNavigate();
  // An unfinished email link wins over any session already in this browser
  const linkPending = useRef(false);
  const redirectingUid = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordLogin, setIsPasswordLogin] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const showToast = (message, severity = "info") => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  const redirectOnLogin = useCallback(async (user) => {
    if (!user || redirectingUid.current === user.uid) return;
    redirectingUid.current = user.uid;

    const next = getNext();
    const storedNext = localStorage.getItem('loginRedirect');
    const target = (next && next !== "/") ? next : (storedNext || "/");
    
    // Optimistic navigation: if we already have a valid unexpired session in localStorage,
    // we can skip the blocking fetch and let RenderPage handle final validation.
    const now = Date.now();
    const cachedExpiresOn = Number(localStorage.expiresOn);
    if (cachedExpiresOn && cachedExpiresOn > now) {
      localStorage.removeItem('loginRedirect');
      navigate(target, { replace: true });
      // Still sync in background
      syncUserData(user);
      return;
    }

    setLoading(true);
    try {
      // Parallelize fetches for faster first-time login
      const { expiresOn } = await syncUserData(user);
      const admin = await checkRefOnce(`/admin/${user.uid}`);
      
      if (admin !== null) localStorage.admin = 1;
      else delete localStorage.admin;
      
      localStorage.uid = user.uid;
      localStorage.displayName = user.displayName;
      localStorage.email = user.email;
      localStorage.photoURL = user.photoURL;

      const cameFromMagicLink = window.sessionStorage.getItem('magicLinkSignIn') === '1';
      if (cameFromMagicLink) {
        window.sessionStorage.removeItem('magicLinkSignIn');
      }

      localStorage.removeItem('loginRedirect');

      if (expiresOn) {
        if (cameFromMagicLink) {
          window.location.replace(target);
        } else {
          navigate(target, { replace: true });
        }
      } else {
        const payTarget = "/pay";
        if (cameFromMagicLink) {
          window.location.replace(payTarget);
        } else {
          navigate(payTarget, { replace: true });
        }
      }
    } catch (err) {
      console.error(err);
      redirectingUid.current = null;
      showToast("Error setting up user session.", "error");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const leaveLinkFlow = useCallback(() => {
    linkPending.current = false;
    setConfirmEmail(false);
    // A used code left in the address would be copied into the next link's return URL
    const params = new URLSearchParams(window.location.search);
    LINK_PARAMS.forEach((param) => params.delete(param));
    const search = params.toString();
    navigate(
      { pathname: '/login', search: search && `?${search}`, hash: window.location.hash },
      { replace: true }
    );
  }, [navigate]);

  const handleCompleteSignIn = useCallback(async (emailToUse) => {
    setLoading(true);
    try {
      const { user } = await signInWithEmailLink(auth, emailToUse, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      showToast("Successfully signed in!", "success");
      linkPending.current = false;
      // onAuthStateChanged doesn't fire if this user was already signed in
      await redirectOnLogin(user);
    } catch (error) {
      console.error(error);
      setLoading(false);
      if (error.code === 'auth/invalid-email') {
        // The link is still good, it was just sent to a different address
        setConfirmEmail(true);
        showToast(WRONG_ADDRESS_MESSAGE, "error");
        return;
      }
      if (!USED_LINK_CODES.includes(error.code)) {
        // The link may still be good, so keep it in the address for a retry
        setEmail(emailToUse);
        setConfirmEmail(true);
        showToast(authErrorMessage(error), "error");
        return;
      }
      if (auth.currentUser?.email?.toLowerCase() === emailToUse.trim().toLowerCase()) {
        // Reopening a link that already signed this person in
        linkPending.current = false;
        await redirectOnLogin(auth.currentUser);
        return;
      }
      leaveLinkFlow();
      showToast(USED_LINK_MESSAGE, "error");
    }
  }, [redirectOnLogin, leaveLinkFlow]);

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      linkPending.current = true;
      window.sessionStorage.setItem('magicLinkSignIn', '1');
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');

      if (emailForSignIn) {
        setTimeout(() => handleCompleteSignIn(emailForSignIn), 0);
      } else {
        // If email is missing, we need the user to provide it for confirmation
        setConfirmEmail(true);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || linkPending.current) return;
      // Always fetch fresh expiry from RTDB before routing decision
      // Don't trust localStorage alone - it may be stale
      redirectOnLogin(user);
    });

    return () => unsubscribe();
  }, [navigate, redirectOnLogin, handleCompleteSignIn]);

  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      showToast("Successfully signed in!", "success");
      // onAuthStateChanged doesn't fire if this user was already signed in
      await redirectOnLogin(user);
    } catch (error) {
       console.error(error);
       showToast(authErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    if (!email) {
      showToast("Please enter your email address first.", "warning");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`
      });
      showToast("Password reset email sent!", "success");
    } catch (error) {
      console.error(error);
      showToast(authErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const next = getNext();
    const { origin, search, hash } = window.location;

    // Persist next param to localStorage for restoration after email click
    if (next && next !== '/') {
      window.localStorage.setItem('loginRedirect', next);
    } else if (search.includes('next=')) {
      // Fallback: capture next from current search if getNext missed it
      window.localStorage.setItem('loginRedirect', search.replace('?next=', '').split('&')[0]);
    }

    // Preserve any pending next parameter so the magic link returns users to their original destination
    const nextQuery = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : search || '';
    const redirectUrl = `${origin}/login${nextQuery}${hash || ''}`;

    const actionCodeSettings = {
      // Use window.location.origin for the base URL
      url: redirectUrl, 
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      showToast("Magic link sent! Check your inbox.", "success");
    } catch (err) {
      console.error(err);
      showToast(authErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmailSubmit = (e) => {
    e.preventDefault();
    if (email) {
      handleCompleteSignIn(email);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Box 
        sx={{ 
          flex: 1,
          background: (theme) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #121212 0%, #2c1a1a 100%)' 
            : 'linear-gradient(135deg, #fffaf0 0%, #ffe4b5 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 3,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative elements */}
        <Box sx={{ 
          position: 'absolute', 
          width: 300, 
          height: 300, 
          borderRadius: '50%', 
          background: 'rgba(230, 81, 0, 0.1)', 
          top: -100, 
          right: -100,
          zIndex: 0
        }} />
        <Box sx={{ 
          position: 'absolute', 
          width: 200, 
          height: 200, 
          borderRadius: '50%', 
          background: 'rgba(46, 125, 50, 0.1)', 
          bottom: -50, 
          left: -50,
          zIndex: 0
        }} />

        <Fade in={true} timeout={1000}>
          <Paper 
            elevation={15}
            sx={{ 
              padding: { xs: 4, sm: 6 },
              width: '100%',
              maxWidth: 480,
              borderRadius: 5,
              backdropFilter: 'blur(15px)',
              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(30, 30, 30, 0.85)' 
                : 'rgba(255, 255, 255, 0.85)',
              textAlign: 'center',
              zIndex: 1,
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 8px 32px 0 rgba(0, 0, 0, 0.7)'
                : '0 8px 32px 0 rgba(230, 81, 0, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 5, color: 'text.secondary', fontStyle: 'italic' }}>
              Sing with Amma
            </Typography>

            {!confirmEmail ? (
              <Box sx={{ mt: 2 }}>
                 <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  {isPasswordLogin ? "Sign In" : "Passwordless Sign In"}
                </Typography>

                {!isPasswordLogin ? (
                  <Box component="form" onSubmit={handleSendLink}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      variant="outlined"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      sx={{ mb: 4 }}
                      placeholder="name@example.com"
                      disabled={loading}
                      autoFocus
                    />

                    <Button 
                      fullWidth 
                      variant="contained" 
                      type="submit" 
                      size="large"
                      disabled={loading}
                      sx={{ 
                        py: 2, 
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        borderRadius: 3,
                        textTransform: 'none',
                        boxShadow: '0 4px 14px 0 rgba(230, 81, 0, 0.39)'
                      }}
                    >
                      {loading ? <CircularProgress size={26} color="inherit" /> : "Send Magic Link"}
                    </Button>

                    <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary', px: 2, lineHeight: 1.6 }}>
                      Enter your email to receive a secure login link. No password required!
                    </Typography>
                  </Box>
                ) : (
                  <Box component="form" onSubmit={handlePasswordSignIn}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      variant="outlined"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      sx={{ mb: 2 }}
                      disabled={loading}
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      variant="outlined"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      sx={{ mb: 4 }}
                      disabled={loading}
                    />
                    <Button 
                      fullWidth 
                      variant="contained" 
                      type="submit" 
                      size="large"
                      disabled={loading}
                      sx={{ py: 2, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: 3, textTransform: 'none' }}
                    >
                      {loading ? <CircularProgress size={26} color="inherit" /> : "Sign In"}
                    </Button>
                    <Box sx={{ mt: 1, textAlign: 'right' }}>
                      <Button
                        onClick={handleResetPassword}
                        sx={{ textTransform: 'none', fontSize: '0.85rem' }}
                        disabled={loading}
                      >
                        Forgot Password?
                      </Button>
                    </Box>
                  </Box>
                )}
                
                <Button 
                  onClick={() => setIsPasswordLogin(!isPasswordLogin)}
                  sx={{ mt: 2, textTransform: 'none' }}
                >
                  {isPasswordLogin ? "Use Magic Link instead" : "Use Password instead"}
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleConfirmEmailSubmit} sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Confirm Your Email
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Please enter the email address this sign-in link was sent to.
                </Typography>
                <TextField
                  fullWidth
                  label="Email Address"
                  variant="outlined"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  sx={{ mb: 4 }}
                  disabled={loading}
                  autoFocus
                />
                <Button 
                  fullWidth 
                  variant="contained" 
                  type="submit" 
                  size="large"
                  disabled={loading}
                  sx={{ py: 2, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: 3, textTransform: 'none' }}
                >
                  {loading ? <CircularProgress size={26} color="inherit" /> : "Verify & Sign In"}
                </Button>
                <Button
                  onClick={leaveLinkFlow}
                  sx={{ mt: 2, textTransform: 'none' }}
                  disabled={loading}
                >
                  Request a new link
                </Button>
              </Box>
            )}
          </Paper>
        </Fade>

        <Snackbar 
          open={toast.open} 
          autoHideDuration={6000} 
          onClose={handleCloseToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {/* @ts-ignore */}
          <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 3 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default Login;
