// @ts-nocheck
import React, { useEffect, useState, useCallback } from "react";
import { auth, checkRefOnce } from "./firebase";
import { 
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  onAuthStateChanged 
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

const Login = () => {
  const navigate = useNavigate();
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
    if (!user) return;
    setLoading(true);
    try {
      const expiresOn = await checkRefOnce(`/paid/${user.uid}/expiresOn`);
      const admin = await checkRefOnce(`/admin/${user.uid}`);
      const next = getNext();
      
      localStorage.lastOnline = +new Date();
      if (admin !== null) localStorage.admin = 1;
      
      localStorage.uid = user.uid;
      localStorage.displayName = user.displayName;
      localStorage.email = user.email;
      localStorage.photoURL = user.photoURL;

      if (expiresOn) {
        localStorage.expiresOn = +expiresOn;
        // Check for stored redirect from magic link flow
        const storedNext = localStorage.getItem('loginRedirect');
        localStorage.removeItem('loginRedirect'); // Clean up
        const target = next && next !== "/" ? next : (storedNext || "/");
        navigate(target, { replace: true });
      } else {
        navigate("/pay", { replace: true });
      }
    } catch (err) {
      console.error(err);
      showToast("Error setting up user session.", "error");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleCompleteSignIn = useCallback((emailToUse) => {
    setLoading(true);
    signInWithEmailLink(auth, emailToUse, window.location.href)
      .then(() => {
        window.localStorage.removeItem('emailForSignIn');
        showToast("Successfully signed in!", "success");
      })
      .catch((error) => {
        console.error(error);
        showToast(error.message.replace('Firebase: ', ''), "error");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');
      
      if (!emailForSignIn) {
        // If email is missing, we need the user to provide it for confirmation
        setConfirmEmail(true);
        return;
      }
      
      setTimeout(() => handleCompleteSignIn(emailForSignIn), 0);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
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
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Successfully signed in!", "success");
      // redirectOnLogin will handle the rest via onAuthStateChanged
    } catch (error) {
       console.error(error);
       showToast(error.message.replace('Firebase: ', ''), "error");
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
      showToast(err.message.replace('Firebase: ', ''), "error");
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
                  Please re-type your email to complete the sign-in process.
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
